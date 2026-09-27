import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, Search, AlertCircle } from 'lucide-react';
import { api, OpportunityItem } from '../api/client';
import { OpportunityCard } from '../components/OpportunityCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface OpportunitiesProps {
  theme: 'light' | 'dark';
}

export const Opportunities: React.FC<OpportunitiesProps> = ({ theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [query, setQuery] = useState('India sustainable packaging D2C');
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [newsConfigured, setNewsConfigured] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = async (searchQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOpportunities(searchQuery);
      setOpportunities(res.opportunities || []);
      setNewsConfigured(res.news_api_configured);
      setStatusMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Opportunity Radar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, []);

  const handleConvert = (opp: OpportunityItem) => {
    const spec = opp.product_specification;
    const params = new URLSearchParams({
      mission_name: opp.product_idea,
      product_name: opp.product_idea,
      product_category: spec.product_category,
      material: spec.material,
      quantity: String(spec.quantity),
      target_unit_cost: String(spec.target_unit_cost),
      maximum_budget: String(spec.maximum_budget),
      certification_requirements: spec.certification_requirements,
      packaging_requirements: spec.packaging_requirements,
      preferred_sourcing_location: spec.preferred_sourcing_location,
      delivery_deadline: String(spec.delivery_deadline),
    });
    navigate(`/missions/new?${params.toString()}`);
  };

  if (loading) {
    return (
      <LoadingState message="Scanning Opportunity Radar..." theme={theme} />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Opportunity Radar Error"
        message={error}
        onRetry={() => loadOpportunities(query)}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Secondary Capability — Market Signal Intelligence
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Opportunity Radar (Fact vs. Inference vs. Hypothesis)
          </h1>
          <p
            className={`mt-1 text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Separates verified news signals (Fact) from market interpretation (Inference) and actionable D2C product specifications (Opportunity Hypothesis).
          </p>
        </div>
      </div>

      {/* Honest News API Configuration Status */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 ${
          newsConfigured
            ? 'border-[#15803D]/40 bg-[#15803D]/5'
            : isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {newsConfigured ? (
            <Radar className="h-4 w-4 text-[#15803D]" />
          ) : (
            <AlertCircle className="h-4 w-4 text-[#D97706]" />
          )}
          <span className="text-xs font-medium">{statusMessage}</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadOpportunities(query);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-[#78716C]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search live News API signals..."
              className={`rounded-md border py-1.5 pr-3 pl-8 text-xs ${
                isLight
                  ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                  : 'border-[#292524] bg-[#0C0A09]'
              }`}
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-[#C84B31] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26]"
          >
            Refresh Signals
          </button>
        </form>
      </div>

      {opportunities.length === 0 ? (
        <div
          className={`rounded-md border p-8 text-center ${
            isLight
              ? 'border-[#E7E5E4] bg-white'
              : 'border-[#292524] bg-[#1C1917]'
          }`}
        >
          <h3 className="text-base font-bold">
            Live News API Signals Not Available
          </h3>
          <p
            className={`mx-auto mt-1 max-w-lg text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            {statusMessage ||
              'News API is not configured in this environment. Vendra never fabricates fake live news articles. You can create a custom sourcing mission directly from Mission Control.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/missions/new')}
            className="mt-4 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
          >
            Create Custom Sourcing Mission
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onConvertToMission={handleConvert}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
};
