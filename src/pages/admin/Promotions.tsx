import { PageHeader } from '@/components/shared';
import { PromotionManagement } from '@/components/admin/PromotionManagement';

const Promotions = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Create and manage discount codes for customers"
      />
      <PromotionManagement />
    </div>
  );
};

export default Promotions;
