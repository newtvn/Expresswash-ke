import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  marketingOptIn: boolean;
  orderUpdates: boolean;
  paymentReminders: boolean;
}

const DEFAULTS: NotificationPreferences = {
  smsEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  marketingOptIn: true,
  orderUpdates: true,
  paymentReminders: true,
};

export async function getMyPreferences(profileId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error || !data) return DEFAULTS;

  return {
    smsEnabled: data.sms_enabled ?? DEFAULTS.smsEnabled,
    emailEnabled: data.email_enabled ?? DEFAULTS.emailEnabled,
    whatsappEnabled: data.whatsapp_enabled ?? DEFAULTS.whatsappEnabled,
    marketingOptIn: data.marketing_opt_in ?? DEFAULTS.marketingOptIn,
    orderUpdates: data.order_updates ?? DEFAULTS.orderUpdates,
    paymentReminders: data.payment_reminders ?? DEFAULTS.paymentReminders,
  };
}

export async function updateMyPreferences(
  profileId: string,
  prefs: NotificationPreferences,
): Promise<boolean> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        profile_id: profileId,
        sms_enabled: prefs.smsEnabled,
        email_enabled: prefs.emailEnabled,
        whatsapp_enabled: prefs.whatsappEnabled,
        marketing_opt_in: prefs.marketingOptIn,
        order_updates: prefs.orderUpdates,
        payment_reminders: prefs.paymentReminders,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    );

  return !error;
}
