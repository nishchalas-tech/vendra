import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, Supplier } from '../api/client';
import { SupplierTable } from '../components/SupplierTable';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface SuppliersProps {
  theme: 'light' | 'dark';
}

export const Suppliers: React.FC<SuppliersProps> = ({ theme }) => {
  const isLight = theme === 'light';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSuppliers();
      setSuppliers(res.suppliers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  if (loading) {
    return <LoadingState message="Loading supplier catalog..." theme={theme} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Supplier Catalog Error"
        message={error}
        onRetry={fetchSuppliers}
        theme={theme}
      />
    );
  }

  const cities = [
    'ALL',
    ...Array.from(new Set(suppliers.map((s) => s.city).filter(Boolean))),
  ];

  const filtered = suppliers.filter((s) => {
    const matchesCity = selectedCity === 'ALL' || s.city === selectedCity;
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.manufacturing_capabilities.toLowerCase().includes(q) ||
      s.materials.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.certifications.toLowerCase().includes(q);
    return matchesCity && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            India Manufacturing Directory
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Verified & Illustrative Supplier Catalog ({filtered.length})
          </h1>
          <p
            className={`mt-1 text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Every supplier record carries explicit evidence provenance. Illustrative demo records are clearly labeled.
          </p>
        </div>
      </div>

      {/* Search & Cluster Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#78716C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by capability, material, certification, or city..."
            className={`w-full rounded-md border py-2 pr-3 pl-9 text-xs ${
              isLight
                ? 'border-[#E7E5E4] bg-white text-[#1C1917]'
                : 'border-[#292524] bg-[#1C1917] text-[#F5F5F4]'
            }`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCity(c)}
              className={`rounded-[4px] border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase ${
                selectedCity === c
                  ? 'border-[#C84B31] bg-[#C84B31] text-white'
                  : isLight
                    ? 'border-[#E7E5E4] bg-white text-[#57534E] hover:bg-[#F3EFEA]'
                    : 'border-[#292524] bg-[#1C1917] text-[#A8A29E] hover:bg-[#292524]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <SupplierTable suppliers={filtered} theme={theme} />
    </div>
  );
};
