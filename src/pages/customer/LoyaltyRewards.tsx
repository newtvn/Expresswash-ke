import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { LoyaltyProgress } from '@/components/customer/LoyaltyProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Gift, Star, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getLoyaltyAccount, getLoyaltyTransactions, getRewards, redeemReward } from '@/services/loyaltyService';

export const LoyaltyRewards = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['customer', 'loyalty', user?.id],
    queryFn: () => getLoyaltyAccount(user!.id),
    enabled: !!user?.id,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['customer', 'loyalty', 'transactions', user?.id],
    queryFn: () => getLoyaltyTransactions(user!.id),
    enabled: !!user?.id,
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: getRewards,
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) => redeemReward(user!.id, rewardId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        qc.invalidateQueries({ queryKey: ['customer', 'loyalty', user?.id] });
      } else {
        toast.error(data.message);
      }
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty Rewards" description="Earn points with every order and redeem for discounts" />

      {accountLoading ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : (
        <LoyaltyProgress
          points={account?.points ?? 0}
          tier={account?.tier ?? 'bronze'}
          tierProgress={account?.tierProgress ?? 0}
          nextTier={account?.nextTier ?? 'silver'}
          pointsToNextTier={account?.pointsToNextTier ?? 0}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />Available Rewards</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rewards.filter((r) => r.isActive).map((reward) => (
              <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{reward.name}</p>
                  <p className="text-xs text-muted-foreground">{reward.description}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">{reward.pointsCost} pts</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(account?.points ?? 0) < reward.pointsCost || redeemMutation.isPending}
                  onClick={() => redeemMutation.mutate(reward.id)}
                >
                  Redeem
                </Button>
              </div>
            ))}
            {rewards.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No rewards available</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Points History</CardTitle></CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-sm font-semibold flex items-center gap-1 ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                      <ArrowUpRight className={`h-3 w-3 ${tx.points < 0 ? 'rotate-180' : ''}`} />
                    </span>
                  </div>
                ))}
                {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoyaltyRewards;
