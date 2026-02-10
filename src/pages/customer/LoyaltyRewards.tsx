import { useState } from 'react';
import { PageHeader, KPICard, ConfirmDialog } from '@/components/shared';
import { LoyaltyProgress } from '@/components/customer/LoyaltyProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Gift, Star, Percent } from 'lucide-react';

interface RewardItem {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  icon: string;
}

const mockRewards: RewardItem[] = [
  { id: '1', name: '10% Off Next Order', description: 'Get 10% discount on your next cleaning order', pointsCost: 500, icon: 'percent' },
  { id: '2', name: 'Free Curtain Cleaning', description: 'One pair of curtains cleaned for free', pointsCost: 800, icon: 'gift' },
  { id: '3', name: '20% Off Carpet Cleaning', description: '20% discount on any carpet cleaning service', pointsCost: 1000, icon: 'percent' },
  { id: '4', name: 'Free Delivery', description: 'Free pickup and delivery on your next order', pointsCost: 300, icon: 'gift' },
  { id: '5', name: 'Priority Processing', description: 'Jump the queue with priority processing', pointsCost: 600, icon: 'star' },
  { id: '6', name: 'Free Rug Cleaning', description: 'One medium rug cleaned completely free', pointsCost: 1200, icon: 'gift' },
  { id: '7', name: '15% Off Any Service', description: '15% discount applicable to all services', pointsCost: 750, icon: 'percent' },
  { id: '8', name: 'VIP Treatment', description: 'Premium handling and express turnaround', pointsCost: 1500, icon: 'star' },
];

const iconMap: Record<string, React.ElementType> = {
  percent: Percent,
  gift: Gift,
  star: Star,
};

export const LoyaltyRewards = () => {
  const [redeemId, setRedeemId] = useState<string | null>(null);
  const currentPoints = 1250;

  const selectedReward = mockRewards.find((r) => r.id === redeemId);

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty & Rewards" description="Earn points and redeem exciting rewards" />

      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Current Points"
          value={currentPoints}
          change={15}
          changeDirection="up"
          icon={Award}
        />
        <KPICard
          label="Lifetime Points"
          value={4850}
          change={0}
          changeDirection="flat"
          icon={Star}
        />
        <div className="md:col-span-1">
          <LoyaltyProgress
            points={currentPoints}
            tier="silver"
            tierProgress={62}
            nextTier="gold"
            pointsToNextTier={750}
          />
        </div>
      </div>

      {/* Rewards Catalog */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Rewards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockRewards.map((reward) => {
            const Icon = iconMap[reward.icon] ?? Gift;
            const canRedeem = currentPoints >= reward.pointsCost;

            return (
              <Card key={reward.id} className="hover:shadow-md transition-shadow flex flex-col">
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium">{reward.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <p className="text-xs text-muted-foreground mb-4">{reward.description}</p>
                  <div className="space-y-3">
                    <Badge variant="outline" className="text-xs">
                      {reward.pointsCost.toLocaleString()} points
                    </Badge>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!canRedeem}
                      onClick={() => setRedeemId(reward.id)}
                    >
                      {canRedeem ? 'Redeem' : 'Not enough points'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={!!redeemId}
        onOpenChange={() => setRedeemId(null)}
        title="Redeem Reward"
        description={
          selectedReward
            ? `Are you sure you want to redeem "${selectedReward.name}" for ${selectedReward.pointsCost.toLocaleString()} points?`
            : ''
        }
        confirmLabel="Redeem"
        onConfirm={() => setRedeemId(null)}
      />
    </div>
  );
};

export default LoyaltyRewards;
