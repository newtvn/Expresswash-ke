import { useState, useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { updateUser } from '@/services/userService';
import { supabase } from '@/lib/supabase';

export const Profile = () => {
  const { user, updateUser: updateAuthUser } = useAuth();

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    zone: '',
  });
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const [notifications, setNotifications] = useState({
    sms: true,
    email: true,
    push: false,
  });

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
        toast.success('Password changed successfully');
        setPasswords({ current: '', newPassword: '', confirm: '' });
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
              {(['sms', 'email', 'push'] as const).map((type, i) => (
                <div key={type}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{type === 'sms' ? 'SMS' : type} Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        {type === 'sms' ? 'Receive order updates via SMS' : type === 'email' ? 'Receive invoices via email' : 'Browser push notifications'}
                      </p>
                    </div>
                    <Switch checked={notifications[type]} onCheckedChange={(v) => setNotifications({ ...notifications, [type]: v })} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
