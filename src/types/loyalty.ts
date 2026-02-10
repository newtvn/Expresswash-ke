export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyAccount {
  customerId: string;
  customerName: string;
  points: number;
  tier: LoyaltyTier;
  tierProgress: number;
  lifetimePoints: number;
  nextTier?: LoyaltyTier;
  pointsToNextTier?: number;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  points: number;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'adjustment';
  description: string;
  orderId?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  validUntil?: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  refereeId?: string;
  refereeName?: string;
  refereeEmail: string;
  referralCode: string;
  status: 'pending' | 'completed' | 'expired';
  pointsEarned: number;
  createdAt: string;
  completedAt?: string;
}
