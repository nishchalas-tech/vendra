import React, { useState } from 'react';
import { Mic, Volume2, Send } from 'lucide-react';
import { api, Mission } from '../api/client';

interface VoicePanelProps {
  mission: Mission;
  onMissionUpdated: (mission: Mission) => void;
  theme?: 'light' | 'dark';
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  mission,
  onMissionUpdated,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [transcript, setTranscript] = useState(
    'Supplier B cannot deliver before next month. Find another supplier in Bengaluru under three lakh.',
  );
  const [running, setRunning] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [elevenLabsActive, setElevenLabsActive] = useState<boolean>(false);

  const handleExecuteVoiceCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) return;
    setRunning(true);
    try {
      const res = await api.sendVoiceCommand(mission.id, transcript);
      setResponseText(res.voice_response_text);
      setElevenLabsActive(res.elevenlabs_configured);
      onMissionUpdated(res.mission);

      if (res.audio_base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio_base64}`);
        audio.play().catch(() => {});
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(res.voice_response_text);
        utter.lang = 'en-IN';
        window.speechSynthesis.speak(utter);
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className={`p-5 rounded-lg border ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-stone-200 text-stone-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            Voice Command Pipeline (Orchestrator + Policy Protected)
          </h4>
        </div>
        <span className="text-[11px] font-mono text-stone-500 dark:text-slate-400">
          {elevenLabsActive
            ? 'ElevenLabs TTS: CONFIGURED'
            : 'Voice Engine: Browser Speech + ElevenLabs Ready'}
        </span>
      </div>

      <form onSubmit={handleExecuteVoiceCommand} className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="voice-transcript-input"
            className="block text-xs text-stone-500 dark:text-slate-400 mb-1"
          >
            Spoken / Transcribed Founder Command (never bypasses Policy, Approval,
            or Audit):
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="voice-transcript-input"
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className={`flex-1 px-3 py-2 text-xs rounded-md border ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-slate-100'
                  : 'bg-stone-50 border-stone-300 text-stone-900'
              }`}
            />
            <button
              type="submit"
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{running ? 'Processing…' : 'Run Voice Command'}</span>
            </button>
          </div>
        </div>

        {responseText && (
          <div
            className={`p-3.5 rounded border text-xs flex items-start gap-2.5 ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-200'
                : 'bg-stone-50 border-stone-200 text-stone-800'
            }`}
          >
            <Volume2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                VENDRA VOICE RESPONSE:
              </div>
              <p className="mt-0.5 leading-relaxed">{responseText}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
