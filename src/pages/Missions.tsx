import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Play } from 'lucide-react';
import { api, Mission } from '../api/client';
import { MissionCard } from '../components/MissionCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface MissionsProps {
  theme: 'light' | 'dark';
  onLoadDemo: () => void;
  loadingDemo?: boolean;
}

export const Missions: React.FC<MissionsProps> = ({
  theme,
  onLoadDemo,
  loadingDemo,
}) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<string>('ALL');

  const fetchMissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listMissions();
      setMissions(res.missions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load missions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  if (loading) {
    return <LoadingState message="Loading sourcing missions..." theme={theme} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to Load Missions"
        message={error}
        onRetry={fetchMissions}
        theme={theme}
      />
    );
  }

  const filteredMissions =
    filterState === 'ALL'
      ? missions
      : missions.filter((m) => m.state === filterState);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
            Procurement Execution
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            All Sourcing Missions
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loadingDemo}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold ${
              isLight
                ? 'border-[#C84B31]/40 bg-[#C84B31]/5 text-[#C84B31] hover:bg-[#C84B31]/10'
                : 'border-[#C84B31]/40 bg-[#C84B31]/10 text-[#E05A3F] hover:bg-[#C84B31]/20'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            {loadingDemo ? 'Loading Demo...' : 'Load Demo Scenario'}
          </button>

          <Link
            to="/missions/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#C84B31] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B03E26]"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Mission
          </Link>
        </div>
      </div>

      {/* State Filter Bar */}
      {missions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            'ALL',
            'DRAFT',
            'SUPPLIER_DISCOVERY',
            'RFQ_SENT',
            'RISK_DETECTED',
            'WAITING_FOR_APPROVAL',
            'APPROVED',
          ].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterState(st)}
              className={`rounded-[4px] border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase transition-colors ${
                filterState === st
                  ? 'border-[#C84B31] bg-[#C84B31] text-white'
                  : isLight
                    ? 'border-[#E7E5E4] bg-white text-[#57534E] hover:bg-[#F3EFEA]'
                    : 'border-[#292524] bg-[#1C1917] text-[#A8A29E] hover:bg-[#292524]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {filteredMissions.length === 0 ? (
        <EmptyState
          title="No Missions Match Filter"
          description="Create a new sourcing mission with your target unit cost, MOQ, material, and lead time requirements."
          actionLabel="Create Sourcing Mission"
          onAction={() => navigate('/missions/new')}
          theme={theme}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} theme={theme} />
          ))}
        </div>
      )}
    </div>
  );
};
