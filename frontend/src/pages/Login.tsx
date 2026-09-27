import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setStoredToken, User, Mission } from '../api/client';
import { Navbar } from '../components/Navbar';

interface LoginProps {
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
  onDemoLoaded: (user: User, token: string, mission: Mission) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({
  user,
  onAuthSuccess,
  onDemoLoaded,
  theme,
  onToggleTheme,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const isLight = theme === 'light';

  useEffect(() => {
    // Clear any stale error when opening the Sign In page
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      setStoredToken(res.token);
      onAuthSuccess(res.user, res.token);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = String(err?.message || 'Incorrect email or password.');
      setError(
        msg.toLowerCase().includes('missing authorization header')
          ? 'Incorrect email or password.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoadingDemo(true);
    try {
      const res = await api.loadDemoScenario();
      setStoredToken(res.token);
      onDemoLoaded(res.user, res.token, res.mission);
      navigate(`/missions/${res.mission.id}`);
    } catch (err: any) {
      setError(
        err?.message || 'Vendra could not connect to the backend. Please try again.',
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isLight ? 'bg-[#FAF8F5] text-[#1C1917]' : 'bg-[#0C0A09] text-[#F5F5F4]'
      }`}
    >
      <Navbar
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLoadDemo={handleDemo}
        loadingDemo={loadingDemo}
      />

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
        <div
          className={`rounded-md border p-6 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="mb-6">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
              Founder Authentication
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Sign in to Vendra
            </h1>
            <p
              className={`mt-1 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Access your sourcing missions, supplier quotes, and approval ledger.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#DC2626]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@company.in"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                    : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#C84B31] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B03E26] disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div
            className={`my-6 border-t pt-5 ${
              isLight ? 'border-[#E7E5E4]' : 'border-[#292524]'
            }`}
          >
            <p
              className={`mb-3 text-center text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Evaluating Vendra? Explicitly launch the isolated Demo Mode scenario:
            </p>
            <button
              type="button"
              onClick={handleDemo}
              disabled={loadingDemo}
              className={`w-full rounded-md border px-4 py-2 text-xs font-semibold transition-colors ${
                isLight
                  ? 'border-[#C84B31]/40 bg-[#C84B31]/5 text-[#C84B31] hover:bg-[#C84B31]/10'
                  : 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#E05A3F] hover:bg-[#C84B31]/20'
              }`}
            >
              {loadingDemo
                ? 'Launching Demo...'
                : 'Launch Demo (Isolated Demo Mode)'}
            </button>
          </div>

          <p
            className={`text-center text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            New founder?{' '}
            <Link
              to="/signup"
              className="font-semibold text-[#C84B31] hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
