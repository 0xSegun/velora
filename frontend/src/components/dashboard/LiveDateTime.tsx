'use client';

import { useEffect, useState } from 'react';
import { dashboardAPI, type ServerTime } from '@/lib/api';

interface LiveDateTimeProps {
  initial?: ServerTime;
  location?: string;
}

function formatLocalClock(time: ServerTime): string {
  const d = new Date(time.local);
  if (Number.isNaN(d.getTime())) return time.time_label;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: time.timezone,
  });
}

export default function LiveDateTime({ initial, location }: LiveDateTimeProps) {
  const [clock, setClock] = useState<ServerTime | null>(initial ?? null);

  useEffect(() => {
    if (!clock && initial) setClock(initial);
  }, [initial, clock]);

  useEffect(() => {
    const tick = () => {
      if (!clock) return;
      const utc = new Date();
      const local = new Date(
        utc.toLocaleString('en-US', { timeZone: clock.timezone }),
      );
      setClock((prev) =>
        prev
          ? {
              ...prev,
              utc: utc.toISOString(),
              local: local.toISOString(),
              time_label: formatLocalClock({ ...prev, local: local.toISOString() }),
            }
          : prev,
      );
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [clock?.timezone]);

  useEffect(() => {
    const sync = window.setInterval(() => {
      void dashboardAPI.getServerTime().then(({ data }) => {
        setClock(data as ServerTime);
      });
    }, 60_000);
    return () => window.clearInterval(sync);
  }, []);

  if (!clock) return null;

  return (
    <div className="space-y-0.5">
      {location && (
        <p className="text-xs text-[var(--text-faint)]">{location}</p>
      )}
      <p className="text-sm text-[var(--text-secondary)]">{clock.date_label}</p>
      <p className="text-sm font-medium tabular-nums text-[var(--text-primary)]">
        {formatLocalClock(clock)}{' '}
        <span className="text-[var(--text-muted)]">({clock.timezone_abbrev})</span>
      </p>
    </div>
  );
}