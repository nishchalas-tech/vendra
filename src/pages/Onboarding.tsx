import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FounderProfile, User } from '../api/client';

interface OnboardingProps {
  user: User;
  theme: 'light' | 'dark';
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [form, setForm] = useState<Partial<FounderProfile>>({
    full_name: user.full_name || '',
    company_name: user.company_name || '',
    phone: user.phone || '',
    city: user.city || '',
    state: user.state || '',
    business_experience: '',
    skills: '',
    industry_interests: '',
    available_capital: 0,
    preferred_product_categories: '',
    available_time: '',
    preferred_sourcing_location:
      user.city && user.state ? `${user.city}, ${user.state}` : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProfile()
      .then((res) => {
        if (res.profile) {
          setForm((prev) => ({
            ...prev,
            ...res.profile,
            available_capital: Number(res.profile.available_capital ?? 0),
          }));
        }
      })
      .catch(() => {
        // use user defaults
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.updateProfile(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save founder profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div
        className={`rounded-md border p-6 ${
          isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="mb-6 flex items-center justify-between border-b pb-4 border-[#E7E5E4]/60">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
              Welcome to Vendra — Founder Onboarding
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Configure Business, Location & Capital Profile
            </h1>
            <p
              className={`mt-1 text-xs ${
                isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
              }`}
            >
              Enter your business details, location, and available capital before creating your first manufacturing mission.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="font-mono text-xs underline text-[#78716C] hover:text-[#C84B31]"
          >
            Skip to Dashboard
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs text-[#DC2626]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={form.full_name || ''}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Business / Company Name
              </label>
              <input
                type="text"
                value={form.company_name || ''}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
                placeholder="Your company name"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                City
              </label>
              <input
                type="text"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                State
              </label>
              <input
                type="text"
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Available Capital (INR ₹)
              </label>
              <input
                type="number"
                min={0}
                value={form.available_capital ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    available_capital: Number(e.target.value),
                  })
                }
                className={`mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Business Experience
              </label>
              <input
                type="text"
                value={form.business_experience || ''}
                onChange={(e) =>
                  setForm({ ...form, business_experience: e.target.value })
                }
                placeholder="e.g., D2C Founder, Operations Lead"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Available Time Commitment
              </label>
              <input
                type="text"
                value={form.available_time || ''}
                onChange={(e) =>
                  setForm({ ...form, available_time: e.target.value })
                }
                placeholder="e.g., Full-time"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
              Skills & Operational Strengths
            </label>
            <input
              type="text"
              value={form.skills || ''}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="e.g., Product Design, Supply Chain, E-commerce"
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Industry Interests
              </label>
              <input
                type="text"
                value={form.industry_interests || ''}
                onChange={(e) =>
                  setForm({ ...form, industry_interests: e.target.value })
                }
                placeholder="e.g., Consumer Goods, Packaging"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
                Preferred Product Categories
              </label>
              <input
                type="text"
                value={form.preferred_product_categories || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    preferred_product_categories: e.target.value,
                  })
                }
                placeholder="e.g., Kitchen & Dining, Apparel"
                className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider">
              Preferred Sourcing Location (City / State)
            </label>
            <input
              type="text"
              value={form.preferred_sourcing_location || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  preferred_sourcing_location: e.target.value,
                })
              }
              placeholder="e.g., Bengaluru, Karnataka"
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[#C84B31] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B03E26] disabled:opacity-50"
            >
              {loading ? 'Saving Profile...' : 'Save Profile & Open Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
