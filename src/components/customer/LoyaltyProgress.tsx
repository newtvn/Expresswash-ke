import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LoyaltyTier } from '@/types';

interface LoyaltyProgressProps {
  points: number;
  tier: LoyaltyTier;
  tierProgress: number;
  nextTier?: LoyaltyTier;
  pointsToNextTier?: number;
  className?: string;
}

const tierColors: Record<LoyaltyTier, string> = {
  bronze: 'bg-amber-700 text-white',
  silver: 'bg-gray-400 text-white',
  gold: 'bg-yellow-500 text-white',
  platinum: 'bg-slate-700 text-white',
};

const tierLabels: Record<LoyaltyTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

export function LoyaltyProgress({
  points,
  tier,
  tierProgress,
  nextTier,
  pointsToNextTier,
  className,
}: LoyaltyProgressProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          Loyalty Status
        </CardTitle>
        <Badge className={cn('border-0', tierColors[tier])}>
          {tierLabels[tier]}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold">{points.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Available Points</p>
          </div>

          {nextTier && pointsToNextTier !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Progress to {tierLabels[nextTier]}
                </span>
                <span className="font-medium">{Math.round(tierProgress)}%</span>
              </div>
              <Progress value={tierProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {pointsToNextTier.toLocaleString()} points to {tierLabels[nextTier]}
              </p>
            </div>
          )}

          {!nextTier && (
            <p className="text-xs text-muted-foreground">
              You have reached the highest tier.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
