import React, { useEffect, useState } from 'react';
import { api, FounderProfile, User, formatINR } from '../api/client';
import { ThemeToggle } from '../components/ThemeToggle';

interface SettingsProps {
  user: User;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  user,
  theme,
  onToggleTheme,
}) => {
  const isLight = theme === 'light';
  const [profile, setProfile] = useState<Partial<FounderProfile>>({});
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProfile()
      .then((res) => setProfile(res.profile || {}))
      .catch(() => {});
    api
      .checkHealth()
      .then((res) => setIntegrations(res.integrations || {}))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await api.updateProfile(profile);
      setProfile(res.profile);
      setSavedMsg('Founder profile updated.');
    } catch {
      setSavedMsg('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Workspace & Preferences
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Founder Profile & System Integrations
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#78716C]">
            Interface Theme:
          </span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Founder Profile Form */}
      <div
        className={`rounded-md border p-6 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <h2 className="mb-4 text-base font-bold">
          Founder Profile & Sourcing Parameters
        </h2>

        {savedMsg && (
          <div className="mb-4 rounded-[4px] border border-[#15803D]/40 bg-[#15803D]/10 p-2.5 text-xs text-[#15803D]">
            {savedMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name || user.full_name || ''}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                City
              </label>
              <input
                type="text"
                value={profile.city || ''}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                Available Capital (₹)
              </label>
              <input
                type="number"
                value={profile.available_capital ?? 0}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    available_capital: Number(e.target.value),
                  })
                }
                className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                Preferred Sourcing Location
              </label>
              <input
                type="text"
                value={profile.preferred_sourcing_location || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    preferred_sourcing_location: e.target.value,
                  })
                }
                className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase">
                Preferred Product Categories
              </label>
              <input
                type="text"
                value={profile.preferred_product_categories || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    preferred_product_categories: e.target.value,
                  })
                }
                className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Honest Integration Status */}
      <div
        className={`rounded-md border p-6 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <h2 className="mb-2 text-base font-bold">
          External Integration Configuration Status
        </h2>
        <p
          className={`mb-4 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Reflects live backend environment configuration (`GET /health`).
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(integrations).map(([key, status]) => (
            <div
              key={key}
              className={`flex items-center justify-between rounded-[4px] border p-3 ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            >
              <span className="font-mono text-xs uppercase">{key}</span>
              <span
                className={`rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                  status === 'configured' || status === 'active'
                    ? 'border-[#15803D]/40 bg-[#15803D]/10 text-[#15803D]'
                    : 'border-[#78716C]/40 bg-[#78716C]/10 text-[#78716C]'
                }`}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
