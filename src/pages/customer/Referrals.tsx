import { useState } from 'react';
import { PageHeader, DataTable, KPICard, StatusBadge } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Award, Copy, Send } from 'lucide-react';

const referralCode = 'EWASH-WANJIKU25';

const mockReferrals = [
  { id: '1', name: 'Peter Kamau', email: 'peter.kamau@email.com', status: 'completed', pointsEarned: 200, date: '2025-01-15' },
  { id: '2', name: 'Grace Njeri', email: 'grace.njeri@email.com', status: 'completed', pointsEarned: 200, date: '2025-01-10' },
  { id: '3', name: 'David Ochieng', email: 'david.ochieng@email.com', status: 'pending', pointsEarned: 0, date: '2025-01-22' },
  { id: '4', name: 'Mary Akinyi', email: 'mary.akinyi@email.com', status: 'completed', pointsEarned: 200, date: '2024-12-28' },
  { id: '5', name: 'Joseph Mwangi', email: 'joseph.mwangi@email.com', status: 'expired', pointsEarned: 0, date: '2024-12-01' },
];

const columns: Column<(typeof mockReferrals)[0]>[] = [
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
  const [inviteEmail, setInviteEmail] = useState('');

  const totalReferrals = mockReferrals.length;
  const successfulReferrals = mockReferrals.filter((r) => r.status === 'completed').length;
  const totalPointsEarned = mockReferrals.reduce((sum, r) => sum + r.pointsEarned, 0);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({ title: 'Copied!', description: 'Referral code copied to clipboard' });
  };

  const handleInvite = () => {
    if (!inviteEmail) return;
    toast({ title: 'Invitation Sent', description: `Referral invitation sent to ${inviteEmail}` });
    setInviteEmail('');
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
        <KPICard
          label="Total Referrals"
          value={totalReferrals}
          change={0}
          changeDirection="flat"
          icon={Users}
        />
        <KPICard
          label="Successful"
          value={successfulReferrals}
          change={25}
          changeDirection="up"
          icon={UserPlus}
        />
        <KPICard
          label="Points Earned"
          value={totalPointsEarned}
          change={15}
          changeDirection="up"
          icon={Award}
        />
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
            <Button onClick={handleInvite} disabled={!inviteEmail}>
              <Send className="mr-2 h-4 w-4" />
              Send Invite
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
          <DataTable
            data={mockReferrals}
            columns={columns}
            searchable={false}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Referrals;
