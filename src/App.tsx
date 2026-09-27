import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import {
  api,
  User,
  Mission,
  getStoredToken,
  setStoredToken,
} from './api/client';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import {
  VendraChatbot,
  VendraChatbotTriggerButton,
} from './components/VendraChatbot';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Missions } from './pages/Missions';
import { CreateMission } from './pages/CreateMission';
import { MissionDetail } from './pages/MissionDetail';
import { Suppliers } from './pages/Suppliers';
import { RFQs } from './pages/RFQs';
import { Approvals } from './pages/Approvals';
import { Risks } from './pages/Risks';
import { AuditLog } from './pages/AuditLog';
import { Opportunities } from './pages/Opportunities';
import { Settings } from './pages/Settings';

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('vendra_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('vendra_theme', next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api
      .me()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  const handleAuthSuccess = (loggedInUser: User, token: string) => {
    setStoredToken(token);
    setUser(loggedInUser);
  };

  const handleDemoLoaded = (
    demoUser: User,
    token: string,
    mission: Mission,
  ) => {
    setStoredToken(token);
    setUser(demoUser);
    navigate(`/missions/${mission.id}`);
  };

  const triggerLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const res = await api.loadDemoScenario();
      handleDemoLoaded(res.user, res.token, res.mission);
    } catch (err) {
      console.error('Demo load failed:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    navigate('/login');
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] font-mono text-xs text-[#57534E]">
        Initializing Vendra Operating System...
      </div>
    );
  }

  const isLight = theme === 'light';

  const renderAuthenticatedLayout = (children: React.ReactNode) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div
        className={`flex min-h-screen ${
          isLight
            ? 'bg-[#FAF8F5] text-[#1C1917]'
            : 'bg-[#0C0A09] text-[#F5F5F4]'
        }`}
      >
        <Sidebar
          user={user}
          theme={theme}
          onLogout={handleLogout}
          onLoadDemo={triggerLoadDemo}
          loadingDemo={loadingDemo}
        />

        <div className="flex flex-1 flex-col min-w-0">
          {/* Top Operational Status Header */}
          <header
            className={`flex h-14 items-center justify-between border-b px-6 ${
              isLight
                ? 'border-[#E7E5E4] bg-white'
                : 'border-[#292524] bg-[#1C1917]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C84B31]">
                Vendra Execution Workspace
              </span>
              {user.is_demo_user && (
                <span className="rounded-[4px] border border-[#0284C7]/40 bg-[#0284C7]/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#0284C7]">
                  Isolated Demo Mode Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setChatbotOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#C84B31]/40 bg-[#C84B31]/10 px-3 py-1 font-mono text-xs font-semibold text-[#C84B31] hover:bg-[#C84B31]/20"
              >
                Vendra AI Chatbot
              </button>
              <span className="hidden font-mono text-xs text-[#78716C] sm:inline">
                {user.full_name} ({user.city || 'India'})
              </span>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
            {children}
          </main>

          <VendraChatbotTriggerButton
            onClick={() => setChatbotOpen(true)}
            theme={theme}
          />
          <VendraChatbot
            theme={theme}
            isOpen={chatbotOpen}
            onClose={() => setChatbotOpen(false)}
          />
        </div>
      </div>
    );
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Landing
            user={user}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLoadDemo={triggerLoadDemo}
            loadingDemo={loadingDemo}
          />
        }
      />
      <Route
        path="/login"
        element={
          <Login
            user={user}
            onAuthSuccess={handleAuthSuccess}
            onDemoLoaded={handleDemoLoaded}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        }
      />
      <Route
        path="/signup"
        element={
          <Signup
            user={user}
            onAuthSuccess={handleAuthSuccess}
            onDemoLoaded={handleDemoLoaded}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        }
      />
      <Route
        path="/onboarding"
        element={renderAuthenticatedLayout(
          user ? <Onboarding user={user} theme={theme} /> : null,
        )}
      />
      <Route
        path="/dashboard"
        element={renderAuthenticatedLayout(
          <Dashboard
            theme={theme}
            onLoadDemo={triggerLoadDemo}
            loadingDemo={loadingDemo}
          />,
        )}
      />
      <Route
        path="/missions"
        element={renderAuthenticatedLayout(
          <Missions
            theme={theme}
            onLoadDemo={triggerLoadDemo}
            loadingDemo={loadingDemo}
          />,
        )}
      />
      <Route
        path="/missions/new"
        element={renderAuthenticatedLayout(<CreateMission theme={theme} />)}
      />
      <Route
        path="/missions/:id"
        element={renderAuthenticatedLayout(<MissionDetail theme={theme} />)}
      />
      <Route
        path="/suppliers"
        element={renderAuthenticatedLayout(<Suppliers theme={theme} />)}
      />
      <Route
        path="/rfqs"
        element={renderAuthenticatedLayout(<RFQs theme={theme} />)}
      />
      <Route
        path="/approvals"
        element={renderAuthenticatedLayout(<Approvals theme={theme} />)}
      />
      <Route
        path="/risks"
        element={renderAuthenticatedLayout(<Risks theme={theme} />)}
      />
      <Route
        path="/audit"
        element={renderAuthenticatedLayout(<AuditLog theme={theme} />)}
      />
      <Route
        path="/opportunities"
        element={renderAuthenticatedLayout(<Opportunities theme={theme} />)}
      />
      <Route
        path="/settings"
        element={renderAuthenticatedLayout(
          user ? (
            <Settings
              user={user}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          ) : null,
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
