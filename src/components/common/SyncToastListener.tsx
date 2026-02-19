import { useEffect } from 'react';
import { useIonToast } from '@ionic/react';
import { addSyncToastListener } from '../../services/syncToast';

export const SyncToastListener: React.FC = () => {
  const [present] = useIonToast();

  useEffect(() => {
    const cleanup = addSyncToastListener((payload) => {
      present({
        message: payload.message,
        color: payload.color,
        duration: payload.duration ?? 1500,
        position: 'top'
      });
    });

    return cleanup;
  }, [present]);

  return null;
};
