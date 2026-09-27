import React, { useEffect, useState } from 'react';
import { api, AuditEventItem } from '../api/client';
import { AuditTimeline } from '../components/AuditTimeline';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

interface AuditLogProps {
  theme: 'light' | 'dark';
}

export const AuditLog: React.FC<AuditLogProps> = ({ theme }) => {
  const isLight = theme === 'light';
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAuditEvents();
      setEvents(res.audit_events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  if (loading) {
    return (
      <LoadingState message="Loading immutable audit ledger..." theme={theme} />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Audit Ledger Error"
        message={error}
        onRetry={loadAudit}
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C84B31]">
          Traceability & Compliance
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Immutable Operational Audit Ledger ({events.length})
        </h1>
        <p
          className={`mt-1 text-xs ${
            isLight ? 'text-[#57534E]' : 'text-[#A8A29E]'
          }`}
        >
          Complete chronological trace of AI agent actions, tool executions, deterministic policy decisions, and human founder approvals.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No Audit Events Recorded"
          description="Create or launch a sourcing mission to begin recording operational events in the audit trail."
          theme={theme}
        />
      ) : (
        <AuditTimeline events={events} theme={theme} />
      )}
    </div>
  );
};
