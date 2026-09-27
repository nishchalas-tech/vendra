import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, RiskItem } from '../api/client';
import { RiskAlertCard } from '../components/RiskAlertCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface RisksProps {
  theme: 'light' | 'dark';
}

export const Risks: React.FC<RisksProps> = ({ theme }) => {
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRisks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRisks();
      setRisks(res.risks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load supply chain risks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, []);

  if (loading) {
    return (
      <LoadingState message="Loading risk & recovery log..." theme={theme} />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Risk Monitor Error"
        message={error}
        onRetry={loadRisks}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          Constraint Breach & Autonomous Recovery
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Supply Chain Risk & Failure Recovery Log ({risks.length})
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Tracks supplier lead time delays, budget overruns, MOQ mismatches, and Vendra's automated backup supplier evaluation.
        </p>
      </div>

      {risks.length === 0 ? (
        <EmptyState
          title="No Supply Chain Risks Detected"
          description="All active supplier quotes currently satisfy mission constraints, or no supplier delays have occurred."
          theme={theme}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {risks.map((risk) => (
            <RiskAlertCard
              key={risk.id}
              risk={risk}
              theme={theme}
              onJumpToApprovals={() => navigate(`/missions/${risk.mission_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
