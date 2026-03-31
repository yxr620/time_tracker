export type SyncToastColor = 'success' | 'danger' | 'warning';

export interface SyncToastPayload {
  message: string;
  color: SyncToastColor;
  duration?: number;
}

const SYNC_TOAST_EVENT = 'app-sync-toast';

export function emitSyncToast(payload: SyncToastPayload): void {
  window.dispatchEvent(new CustomEvent<SyncToastPayload>(SYNC_TOAST_EVENT, { detail: payload }));
}

export function addSyncToastListener(handler: (payload: SyncToastPayload) => void): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SyncToastPayload>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(SYNC_TOAST_EVENT, listener as EventListener);
  return () => window.removeEventListener(SYNC_TOAST_EVENT, listener as EventListener);
}

// ─── Sync Status Indicator Events ───────────────────────────────

export type SyncDirection = 'push' | 'pull' | 'both';

export interface SyncStatusPayload {
  /** 'syncing' = in progress, 'done' = completed with counts, 'error' = failed */
  phase: 'syncing' | 'done' | 'error';
  direction: SyncDirection;
  pushedCount?: number;
  pulledCount?: number;
}

const SYNC_STATUS_EVENT = 'app-sync-status';

export function emitSyncStatus(payload: SyncStatusPayload): void {
  window.dispatchEvent(new CustomEvent<SyncStatusPayload>(SYNC_STATUS_EVENT, { detail: payload }));
}

export function addSyncStatusListener(handler: (payload: SyncStatusPayload) => void): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SyncStatusPayload>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(SYNC_STATUS_EVENT, listener as EventListener);
  return () => window.removeEventListener(SYNC_STATUS_EVENT, listener as EventListener);
}
