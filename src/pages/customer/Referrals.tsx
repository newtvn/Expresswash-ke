import { useState, useEffect, useMemo } from 'react';
import { PageHeader, DataTable, KPICard, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getReferrals, createReferral } from '@/services/loyaltyService';
import { Users, UserPlus, Award, Copy, Send } from 'lucide-react';

interface ReferralRow {
  id: string;
  name: string;
  email: string;
  status: string;
  pointsEarned: number;
  date: string;
}

const columns: Column<ReferralRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
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
];

export const Referrals = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate referral code from user's name
  const referralCode = useMemo(() => {
    if (!user?.name) return 'EWASH-REF';
    const firstName = user.name.split(' ')[0].toUpperCase();
    return `EWASH-${firstName}${new Date().getFullYear().toString().slice(-2)}`;
  }, [user?.name]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getReferrals(user.id)
      .then((data) => {
        setReferrals(
          data.map((r) => ({
            id: r.id,
            name: r.refereeName ?? r.refereeEmail,
            email: r.refereeEmail,
            status: r.status,
            pointsEarned: r.pointsEarned,
            date: r.createdAt?.split('T')[0] ?? '',
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const totalReferrals = referrals.length;
  const successfulReferrals = referrals.filter((r) => r.status === 'completed').length;
  const totalPointsEarned = referrals.reduce((sum, r) => sum + r.pointsEarned, 0);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({ title: 'Copied!', description: 'Referral code copied to clipboard' });
  };

  const handleInvite = async () => {
    if (!inviteEmail || !user?.id) return;
    setSending(true);
    const result = await createReferral(user.id, inviteEmail);
    setSending(false);
    if (result.success) {
      toast({ title: 'Invitation Sent', description: result.message });
      setInviteEmail('');
      // Refresh referrals
      const updated = await getReferrals(user.id);
      setReferrals(
        updated.map((r) => ({
          id: r.id,
          name: r.refereeName ?? r.refereeEmail,
          email: r.refereeEmail,
          status: r.status,
          pointsEarned: r.pointsEarned,
          date: r.createdAt?.split('T')[0] ?? '',
        }))
      );
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
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
                  {referralCode}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyCode}>
                  <Copy className="h-4 w-4" />
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
