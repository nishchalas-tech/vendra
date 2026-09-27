import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setStoredToken, User, Mission } from '../api/client';
import { Navbar } from '../components/Navbar';

interface SignupProps {
  user: User | null;
  onAuthSuccess: (user: User, token: string) => void;
  onDemoLoaded: (user: User, token: string, mission: Mission) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Signup: React.FC<SignupProps> = ({
  user,
  onAuthSuccess,
  onDemoLoaded,
  theme,
  onToggleTheme,
}) => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const isLight = theme === 'light';

  useEffect(() => {
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        full_name: fullName,
        email,
        password,
        company_name: companyName,
        phone,
        city: city || 'Bengaluru',
        state: state || 'Karnataka',
      });
      setStoredToken(res.token);
      onAuthSuccess(res.user, res.token);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = String(
        err?.message || 'Account registration failed. Please check your details.',
      );
      setError(
        msg.toLowerCase().includes('missing authorization header')
          ? 'Please check your registration details and try again.'
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

      <div className="mx-auto flex max-w-lg flex-col justify-center px-6 py-12">
        <div
          className={`rounded-md border p-6 ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <div className="mb-6">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
              Founder Registration
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Create Account
            </h1>
            <p
              className={`mt-1 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Starts with your own clean workspace. No demonstration missions or fake data are added to your account.
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  Business / Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or brand name"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.in"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  City / Location
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Bengaluru"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., Karnataka"
                  className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:border-[#C84B31] focus:outline-none ${
                    isLight
                      ? 'border-[#E7E5E4] bg-[#FAF8F5] text-[#1C1917]'
                      : 'border-[#292524] bg-[#0C0A09] text-[#F5F5F4]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Password (min 6 chars) *
              </label>
              <input
                type="password"
                required
                minLength={6}
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p
            className={`mt-6 text-center text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-[#C84B31] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
