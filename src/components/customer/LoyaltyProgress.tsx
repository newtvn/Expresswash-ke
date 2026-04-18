import { Award, Crown, Medal, Star, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

const tierInfo: Record<LoyaltyTier, { icon: typeof Award; titleColor: string; bgAccent: string; minPoints: string; description: string; perks: string[] }> = {
  bronze: {
    icon: Star, titleColor: 'text-orange-600', bgAccent: 'bg-orange-50 border-orange-200',
    minPoints: '0 - 499', description: 'New or occasional customers starting their loyalty journey.',
    perks: ['Earn 1 point per KES 100 spent', 'Access to basic rewards'],
  },
  silver: {
    icon: Award, titleColor: 'text-gray-700', bgAccent: 'bg-gray-50 border-gray-200',
    minPoints: '500 - 1,999', description: 'Regular customers who earn bonus points and unlock standard rewards.',
    perks: ['Redeem points for discounts', 'Referral bonus points'],
  },
  gold: {
    icon: Medal, titleColor: 'text-yellow-700', bgAccent: 'bg-yellow-50 border-yellow-200',
    minPoints: '2,000 - 4,999', description: 'Loyal customers with access to premium rewards and early promotions.',
    perks: ['Early access to promotions', '2x points on referrals', 'Free pickup & delivery'],
  },
  platinum: {
    icon: Crown, titleColor: 'text-violet-700', bgAccent: 'bg-violet-50 border-violet-200',
    minPoints: '5,000+', description: 'Top-tier customers who get priority service, exclusive discounts, and VIP support.',
    perks: ['Priority customer support', 'Exclusive seasonal discounts', 'Free express service', 'Birthday bonus points'],
  },
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

          {/* Tier roadmap */}
          <div className="grid grid-cols-4 gap-2 pt-3 border-t">
            {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((t) => {
              const info = tierInfo[t];
              const TierIcon = info.icon;
              const isActive = t === tier;
              const isPast = ['bronze', 'silver', 'gold', 'platinum'].indexOf(t) < ['bronze', 'silver', 'gold', 'platinum'].indexOf(tier);
              return (
                <TooltipProvider key={t} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-lg cursor-help transition-colors',
                        isActive && 'bg-primary/5 ring-1 ring-primary/20',
                        isPast && 'opacity-50',
                      )}>
                        <TierIcon className={cn('w-4 h-4', isActive ? info.titleColor : 'text-muted-foreground')} />
                        <span className={cn('text-[10px] font-medium', isActive ? info.titleColor : 'text-muted-foreground')}>
                          {tierLabels[t]}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className={cn('max-w-[260px] p-0 overflow-hidden border', info.bgAccent)}>
                      <div className={cn('px-3 py-2 border-b', info.bgAccent)}>
                        <div className="flex items-center gap-2">
                          <TierIcon className={cn('w-4 h-4', info.titleColor)} />
                          <p className={cn('font-bold', info.titleColor)}>{tierLabels[t]} Tier</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{info.minPoints} lifetime points</p>
                      </div>
                      <div className="px-3 py-2 bg-background">
                        <p className="text-xs text-foreground">{info.description}</p>
                        <ul className="mt-2 space-y-1">
                          {info.perks.map((perk) => (
                            <li key={perk} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                              <span className={cn('mt-0.5', info.titleColor)}>&#10003;</span>
                              {perk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
