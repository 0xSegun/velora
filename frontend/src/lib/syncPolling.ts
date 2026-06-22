import { toast } from "@/lib/feedback";

export interface SyncHealthStatus {
  sync_status?: string;
  status?: string;
  countries_synced?: number;
}

export async function pollUntilSyncComplete(
  getHealth: () => Promise<{ data: SyncHealthStatus }>,
  options?: { intervalMs?: number; maxWaitMs?: number },
): Promise<SyncHealthStatus> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxWaitMs = options?.maxWaitMs ?? 900000;
  const started = Date.now();

  const startDeadline = Date.now() + 30000;
  let sawSyncing = false;
  while (Date.now() < startDeadline) {
    const { data } = await getHealth();
    if (data.sync_status === "syncing") {
      sawSyncing = true;
      break;
    }
    if (data.sync_status === "failed") {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!sawSyncing) {
    throw new Error("Sync did not start. Please try again.");
  }

  while (Date.now() - started < maxWaitMs) {
    const { data } = await getHealth();
    if (data.sync_status === "failed") {
      return data;
    }
    if (data.sync_status && data.sync_status !== "syncing") {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Sync is still running. Check back shortly or review sync logs.");
}

export interface BackgroundSyncResponse {
  success?: boolean;
  background?: boolean;
  already_running?: boolean;
  message?: string;
}

export function isBackgroundSyncResponse(data: unknown): data is BackgroundSyncResponse {
  return Boolean(data && typeof data === "object" && "background" in data);
}

export async function runBackgroundSync(
  sync: () => Promise<{ data: unknown }>,
  getHealth: () => Promise<{ data: SyncHealthStatus }>,
  labels: { started: string; complete: string; failed: string },
  options?: { maxWaitMs?: number },
): Promise<SyncHealthStatus | null> {
  const { data } = await sync();
  const result = data as BackgroundSyncResponse;

  if (result.background) {
    if (result.already_running) {
      toast.info(result.message ?? "Sync already in progress");
    } else {
      toast.success(result.message ?? labels.started);
    }
    const finalHealth = await pollUntilSyncComplete(getHealth, {
      maxWaitMs: options?.maxWaitMs,
    });
    if (finalHealth.sync_status === "success") {
      const count = finalHealth.countries_synced;
      toast.success(
        count != null ? `${labels.complete} (${count} countries stored)` : labels.complete,
      );
    } else if (finalHealth.sync_status === "failed") {
      toast.error(labels.failed);
    }
    return finalHealth;
  }

  if (result.success !== false) {
    toast.success(result.message ?? labels.complete);
  } else {
    toast.error(result.message ?? labels.failed);
  }
  return null;
}