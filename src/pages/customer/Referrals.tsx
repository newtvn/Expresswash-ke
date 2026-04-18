import { useState, useEffect, useCallback } from 'react';
import { PageHeader, DataTable, KPICard, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getReferrals, createReferral, resendReferralInvite } from '@/services/loyaltyService';
import { Users, UserPlus, Award, Copy, Send, Check, RefreshCw } from 'lucide-react';

interface ReferralRow {
  id: string;
  name: string;
  email: string;
  status: string;
  pointsEarned: number;
  date: string;
}

// columns defined inside component to access resend handler

export const Referrals = () => {
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadReferrals = useCallback(async (userId: string) => {
    const data = await getReferrals(userId);
    const rows = data.map((r) => ({
      id: r.id,
      name: r.refereeName ?? r.refereeEmail,
      email: r.refereeEmail,
      status: r.status,
      pointsEarned: r.pointsEarned,
      date: r.createdAt?.split('T')[0] ?? '',
    }));
    setReferrals(rows);
    // Use the referral code from the most recent referral if available
    if (data.length > 0 && data[0].referralCode) {
      setReferralCode(data[0].referralCode);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadReferrals(user.id).finally(() => setLoading(false));
  }, [user?.id, loadReferrals]);

  const handleResend = async (referralId: string) => {
    if (!user?.id) return;
    const result = await resendReferralInvite(user.id, referralId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const columns: Column<ReferralRow>[] = [
    { key: 'email', header: 'Email' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'pointsEarned',
      header: 'Points Earned',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {row.pointsEarned > 0 ? `+${row.pointsEarned}` : '---'}
        </span>
      ),
    },
    { key: 'date', header: 'Date', sortable: true },
    {
      key: 'id',
      header: '',
      render: (row) => row.status === 'pending' ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-primary"
          onClick={(e) => { e.stopPropagation(); handleResend(row.id); }}
        >
          <RefreshCw className="w-3 h-3" />
          Resend
        </Button>
      ) : null,
    },
  ];

  const totalReferrals = referrals.length;
  const successfulReferrals = referrals.filter((r) => r.status === 'completed').length;
  const totalPointsEarned = referrals.reduce((sum, r) => sum + r.pointsEarned, 0);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success('Referral code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !user?.id) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSending(true);
    try {
      const result = await createReferral(user.id, inviteEmail);
      if (result.success) {
        toast.success(result.message);
        setInviteEmail('');
        if (result.referralCode) {
          setReferralCode(result.referralCode);
        }
        await loadReferrals(user.id);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Referral Program" description="Invite friends and earn loyalty points" />

      {/* Referral Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Referral Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                Share your code with friends. You both earn 200 loyalty points when they complete their first order.
              </p>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-muted rounded-lg font-mono text-lg font-bold tracking-wider">
                  {referralCode ?? 'Send your first invite to get a code'}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyCode} disabled={!referralCode}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Total Referrals" value={totalReferrals} icon={Users} />
        <KPICard label="Successful" value={successfulReferrals} icon={UserPlus} />
        <KPICard label="Points Earned" value={totalPointsEarned} icon={Award} />
      </div>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite a Friend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter friend's email address"
              />
            </div>
            <Button onClick={handleInvite} disabled={!inviteEmail || sending}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No referrals yet. Invite friends to get started!</p>
            </div>
          ) : (
            <DataTable
              data={referrals}
              columns={columns}
              searchable={false}
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Referrals;
