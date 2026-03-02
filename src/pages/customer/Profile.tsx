import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { User, Lock, Bell, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { updateUser } from '@/services/userService';
import { supabase } from '@/lib/supabase';
import { ROUTES } from '@/config/routes';
import {
  getMyPreferences,
  updateMyPreferences,
  type NotificationPreferences,
} from '@/services/notificationPreferencesService';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser: updateAuthUser } = useAuth();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    zone: '',
  });
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const queryClient = useQueryClient();

  const { data: notifPrefs } = useQuery({
    queryKey: ['notificationPreferences', user?.id],
    queryFn: () => getMyPreferences(user!.id),
    enabled: !!user?.id,
  });

  const notifMutation = useMutation({
    mutationFn: (prefs: NotificationPreferences) => updateMyPreferences(user!.id, prefs),
    onSuccess: (success) => {
      if (success) {
        toast.success('Notification preferences saved');
        queryClient.invalidateQueries({ queryKey: ['notificationPreferences', user?.id] });
      } else {
        toast.error('Failed to save preferences');
      }
    },
  });

  const handleNotifToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: value };
    notifMutation.mutate(updated);
  };

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        zone: user.zone ?? '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const result = await updateUser(user.id, {
        name: profile.name,
        phone: profile.phone,
        zone: profile.zone,
      });
      if (result.success) {
        updateAuthUser({ name: profile.name, phone: profile.phone, zone: profile.zone });
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate all fields are filled
    if (!passwords.current || !passwords.newPassword || !passwords.confirm) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    // Prevent using same password
    if (passwords.current === passwords.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setChangingPassword(true);
    try {
      // SECURITY: Verify current password by re-authenticating
      if (!user?.email) {
        toast.error('User email not found');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwords.current,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        return;
      }

      // Current password verified, now update to new password
      const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password changed successfully. Please sign in again.');
        setPasswords({ current: '', newPassword: '', confirm: '' });
        // Sign out to invalidate old session tokens
        await supabase.auth.signOut();
        clearAuth();
        navigate(ROUTES.SIGN_IN);
      }
    } catch (error) {
      toast.error('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile Settings" description="Manage your account information and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="profile-name">Full Name</Label>
              <Input id="profile-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={profile.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
            </div>
            <div>
              <Label htmlFor="profile-phone">Phone Number</Label>
              <Input id="profile-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
            </div>
            <div>
              <Label htmlFor="profile-zone">Service Zone</Label>
              <Select value={profile.zone} onValueChange={(v) => setProfile({ ...profile, zone: v })}>
                <SelectTrigger id="profile-zone"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kitengela">Kitengela</SelectItem>
                  <SelectItem value="Athi River">Athi River</SelectItem>
                  <SelectItem value="Syokimau">Syokimau</SelectItem>
                  <SelectItem value="Mlolongo">Mlolongo</SelectItem>
                  <SelectItem value="nairobi-cbd">Nairobi CBD</SelectItem>
                  <SelectItem value="westlands">Westlands</SelectItem>
                  <SelectItem value="kilimani">Kilimani</SelectItem>
                  <SelectItem value="karen">Karen</SelectItem>
                  <SelectItem value="lavington">Lavington</SelectItem>
                  <SelectItem value="south-bc">South B/C</SelectItem>
                  <SelectItem value="eastlands">Eastlands</SelectItem>
                  <SelectItem value="thika-road">Thika Road</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Repeat new password" />
              </div>
              <Button variant="outline" onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifPrefs ? (
                <>
                  {([
                    { key: 'smsEnabled' as const, label: 'SMS Notifications', desc: 'Receive order updates via SMS' },
                    { key: 'emailEnabled' as const, label: 'Email Notifications', desc: 'Receive invoices and updates via email' },
                    { key: 'whatsappEnabled' as const, label: 'WhatsApp Notifications', desc: 'Receive updates on WhatsApp' },
                    { key: 'marketingOptIn' as const, label: 'Marketing Messages', desc: 'Promotions and special offers' },
                    { key: 'orderUpdates' as const, label: 'Order Updates', desc: 'Status changes for your orders' },
                    { key: 'paymentReminders' as const, label: 'Payment Reminders', desc: 'Reminders for pending invoices' },
                  ]).map((item, i) => (
                    <div key={item.key}>
                      {i > 0 && <Separator className="mb-4" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[item.key]}
                          onCheckedChange={(v) => handleNotifToggle(item.key, v)}
                          disabled={notifMutation.isPending}
                        />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
