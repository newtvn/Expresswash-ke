import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  isPushSupported,
  isPushEnabled,
  registerPushNotifications,
  unregisterPushNotifications,
} from '@/services/pushNotificationService';

export const PushNotificationToggle = () => {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const sup = await isPushSupported();
      setSupported(sup);
      if (sup) {
        const en = await isPushEnabled();
        setEnabled(en);
      }
      setLoading(false);
    };
    check();
  }, []);

  if (!supported || loading) return null;

  const handleToggle = async (checked: boolean) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      if (checked) {
        const success = await registerPushNotifications(user.id);
        if (success) {
          setEnabled(true);
          toast.success('Push notifications enabled');
        } else {
          toast.error('Could not enable push notifications');
        }
      } else {
        const success = await unregisterPushNotifications(user.id);
        if (success) {
          setEnabled(false);
          toast.success('Push notifications disabled');
        } else {
          toast.error('Could not disable push notifications');
        }
      }
    } catch {
      toast.error('Failed to update push notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-sm font-medium">Push Notifications</Label>
        <p className="text-xs text-muted-foreground">Receive alerts for new orders and updates</p>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} disabled={loading} />
    </div>
  );
};
