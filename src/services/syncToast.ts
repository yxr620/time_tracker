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
