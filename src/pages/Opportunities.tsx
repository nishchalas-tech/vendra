import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, Search, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { api, OpportunityItem } from '../api/client';
import { OpportunityCard } from '../components/OpportunityCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface OpportunitiesProps {
  theme: 'light' | 'dark';
}

const LIVE_RADAR_TOPICS = [
  {
    label: 'Startup Funding & Seed Rounds',
    query: 'India startup raises funding seed OR Series A D2C OR consumer',
  },
  {
    label: 'Funded D2C & Consumer Brands',
    query: 'India D2C brand raises funding skincare OR personal care OR apparel',
  },
  {
    label: 'EV, Hardware & DeepTech Funding',
    query: 'India startup raises funding EV OR automotive OR hardware OR robotics',
  },
  {
    label: 'F&B & Quick-Commerce Startups',
    query: 'India food OR beverage OR quick commerce startup raises funding',
  },
  {
    label: 'Sustainable Packaging & CleanTech',
    query: 'India sustainable packaging OR climate tech startup raises funding',
  },
];

export const Opportunities: React.FC<OpportunitiesProps> = ({ theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [query, setQuery] = useState(
    'India startup raises funding seed OR Series A D2C OR consumer',
  );
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [newsConfigured, setNewsConfigured] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = async (
    searchQuery: string,
    nextRefreshIdx: number = 0,
    excludeList: string[] = [],
    isBackgroundRefresh: boolean = false,
  ) => {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await api.getOpportunities(
        searchQuery,
        nextRefreshIdx,
        excludeList,
      );
      const freshItems = res.opportunities || [];
      setOpportunities(freshItems);
      setNewsConfigured(res.news_api_configured);
      setStatusMessage(res.message);
      setRefreshCount(nextRefreshIdx);
      setSeenIds((prev) => {
        const merged = Array.from(
          new Set([...prev, ...freshItems.map((o) => o.id)]),
        );
        // Keep last 16 seen IDs so refreshes cycle through fresh unseen live articles
        return merged.slice(-16);
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Opportunity Radar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOpportunities(query, 0, []);
  }, []);

  const handleRefreshLiveSignals = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nextIdx = refreshCount + 1;
    loadOpportunities(query, nextIdx, seenIds, true);
  };

  const handleSelectTopic = (topicQuery: string) => {
    setQuery(topicQuery);
    const nextIdx = refreshCount + 1;
    loadOpportunities(topicQuery, nextIdx, seenIds, true);
  };

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
      <LoadingState
        message="Scanning Live Startup Funding & Market Signals..."
        theme={theme}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Opportunity Radar Error"
        message={error}
        onRetry={() => loadOpportunities(query, refreshCount, seenIds)}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Live Startup Funding &amp; Market Signal Intelligence
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Opportunity Radar (Fact vs. Inference vs. Hypothesis)
          </h1>
          <p
            className={`mt-1 text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Real-time Indian startup funding rounds and market shifts converted
            into supply-chain inferences and testable physical-product missions.
          </p>
        </div>
      </div>

      {/* Live News Configuration & Search Control Bar */}
      <div
        className={`space-y-3 rounded-md border p-4 ${
          newsConfigured
            ? 'border-[#15803D]/40 bg-[#15803D]/5'
            : isLight
            ? 'border-[#E7E5E4] bg-white'
            : 'border-[#292524] bg-[#1C1917]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {newsConfigured ? (
              <Radar className="h-4 w-4 shrink-0 text-[#15803D]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#D97706]" />
            )}
            <span className="text-xs font-medium break-words">
              {statusMessage}
            </span>
          </div>

          <form
            onSubmit={handleRefreshLiveSignals}
            className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-72">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-[#78716C]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search startup funding, D2C, EV, packaging..."
                className={`w-full rounded-md border py-1.5 pr-3 pl-8 text-xs ${
                  isLight
                    ? 'border-[#E7E5E4] bg-[#FAF8F5]'
                    : 'border-[#292524] bg-[#0C0A09]'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#B03E26] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>
                {refreshing ? 'Fetching Live Ideas...' : 'Refresh Signals'}
              </span>
            </button>
          </form>
        </div>

        {/* Live Startup Funding & Sector Quick-Switch Topics */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#15803D]/20">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-[#78716C] mr-1">
            <Sparkles className="h-3 w-3 text-[#C84B31]" />
            Live Funding Streams:
          </span>
          {LIVE_RADAR_TOPICS.map((topic) => {
            const isActive = query === topic.query;
            return (
              <button
                key={topic.label}
                type="button"
                disabled={refreshing}
                onClick={() => handleSelectTopic(topic.query)}
                className={`rounded border px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
                  isActive
                    ? 'border-[#C84B31] bg-[#C84B31] text-white'
                    : isLight
                    ? 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#C84B31] hover:text-[#1C1917]'
                    : 'border-[#292524] bg-[#1C1917] text-[#A8A29E] hover:border-[#C84B31] hover:text-[#F5F5F4]'
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
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
            No Live Signals Matched That Filter
          </h3>
          <p
            className={`mx-auto mt-1 max-w-lg text-xs ${
              isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
            }`}
          >
            Click &ldquo;Refresh Signals&rdquo; or choose one of the Live
            Funding Streams above to pull a new batch of startup funding and
            manufacturing opportunities.
          </p>
          <button
            type="button"
            onClick={() => handleRefreshLiveSignals()}
            className="mt-4 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
          >
            Fetch Fresh Startup Funding Signals
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
