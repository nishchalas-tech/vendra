import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
let activeBackendPort = Number(
  process.env.VENDRA_BACKEND_PORT || process.env.BACKEND_PORT || 8001,
);
if ([3000, 8000, 8080].includes(activeBackendPort)) {
  // Port 8000 in container environments is reserved by control-plane-agent;
  // use dedicated port 8001 for vendra-backend unless vendra-backend itself is on 8000.
  activeBackendPort = 8001;
}

const getBackendUrl = () => `http://127.0.0.1:${activeBackendPort}`;

// Server-side Gemini SDK initialization
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

let pythonProcess: ChildProcess | null = null;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;
let isShuttingDown = false;

async function isVendraBackendOnPort(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'ok' && data?.service === 'vendra-backend';
  } catch {
    return false;
  }
}

function isTcpPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(400);
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.once('error', () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, '127.0.0.1');
  });
}

async function isPythonBackendHealthy(): Promise<boolean> {
  return isVendraBackendOnPort(activeBackendPort);
}

async function ensurePythonBackendRunning(): Promise<void> {
  if (await isPythonBackendHealthy()) {
    return;
  }
  if (await isVendraBackendOnPort(8001)) {
    activeBackendPort = 8001;
    return;
  }
  if (await isTcpPortInUse(activeBackendPort)) {
    // Occupied by non-Vendra service (e.g. control-plane-agent on 8000)
    activeBackendPort = 8001;
    if (await isVendraBackendOnPort(activeBackendPort)) {
      return;
    }
  }
  if (pythonProcess && pythonProcess.exitCode === null) {
    return;
  }
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(
      '[Process Manager] Max bounded restart attempts reached for vendra-backend.',
    );
    return;
  }

  restartAttempts += 1;
  pythonProcess = spawn('python', ['-m', 'backend.app.main'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VENDRA_BACKEND_PORT: String(activeBackendPort),
      BACKEND_PORT: String(activeBackendPort),
      INTERNAL_GEMINI_PROXY_URL: `http://127.0.0.1:${PORT}/internal/gemini`,
    },
    stdio: 'inherit',
  });

  pythonProcess.on('exit', (code) => {
    pythonProcess = null;
    if (
      !isShuttingDown &&
      code !== 0 &&
      restartAttempts < MAX_RESTART_ATTEMPTS
    ) {
      setTimeout(() => {
        ensurePythonBackendRunning().catch(() => {});
      }, 1000);
    }
  });

  // Wait up to 4 seconds for backend readiness
  for (let i = 0; i < 20; i++) {
    if (await isPythonBackendHealthy()) {
      restartAttempts = 0;
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

function cleanupChildProcesses() {
  isShuttingDown = true;
  if (pythonProcess && pythonProcess.exitCode === null) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}

process.on('SIGINT', () => {
  cleanupChildProcesses();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanupChildProcesses();
  process.exit(0);
});

async function startServer() {
  // Trigger Python backend startup in parallel so port 3000 binds without delay
  void ensurePythonBackendRunning().catch((err) => {
    console.error('[Process Manager] Failed to start Python backend:', err);
  });

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Internal server-side Gemini endpoint used by the Python Mission Orchestrator
  app.post('/internal/gemini', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res
          .status(503)
          .json({ error: 'GEMINI_API_KEY not configured' });
      }
      const {
        prompt,
        systemInstruction,
        responseMimeType,
        useGoogleSearch,
      } = req.body || {};
      const config: Record<string, unknown> = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
      } else if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }

      const candidateModels = useGoogleSearch
        ? [
            'gemini-3.8-flash',
            'gemini-flash-latest',
            'gemini-2.5-flash',
            'gemini-3.1-flash-lite-preview',
          ]
        : [
            'gemini-3.1-flash-lite-preview',
            'gemini-3.8-flash',
            'gemini-flash-latest',
          ];

      let lastErr: unknown = null;
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: String(prompt || ''),
            config,
          });
          const candidate = response.candidates?.[0];
          const groundingMetadata = candidate?.groundingMetadata;
          const groundingChunks = groundingMetadata?.groundingChunks || [];
          const webSearchQueries = groundingMetadata?.webSearchQueries || [];
          return res.json({
            text: response.text || '',
            model: modelName,
            groundingChunks,
            webSearchQueries,
          });
        } catch (err) {
          lastErr = err;
        }
      }

      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      return res.status(500).json({ error: msg });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: msg });
    }
  });

  // Forward /health, /api/*, and /auth/* to the authoritative Python backend
  const proxyToPython = async (req: express.Request, res: express.Response) => {
    try {
      await ensurePythonBackendRunning();
      const targetUrl = `${getBackendUrl()}${req.originalUrl}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (req.headers.authorization) {
        headers['Authorization'] = String(req.headers.authorization);
      }
      if (req.headers['x-n8n-webhook-secret']) {
        headers['X-N8N-Webhook-Secret'] = String(
          req.headers['x-n8n-webhook-secret'],
        );
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };
      if (!['GET', 'HEAD'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const upstream = await fetch(targetUrl, fetchOptions);
      const text = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(text);
    } catch {
      return res.status(502).json({
        error: 'Vendra could not connect to the backend. Please try again.',
      });
    }
  };

  app.get('/health', proxyToPython);
  app.use('/api', proxyToPython);
  app.use('/auth', proxyToPython);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Vendra server running on http://0.0.0.0:${PORT} (Python backend on ${getBackendUrl()})`,
    );
  });
}

startServer();
