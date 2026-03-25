import { Package, Truck, MapPin } from "lucide-react";

interface OrderScheduleCardProps {
  pickupDate: string;
  estimatedDelivery: string;
  zone: string;
}

/**
 * Reusable component to display order schedule information
 */
export const OrderScheduleCard = ({
  pickupDate,
  estimatedDelivery,
  zone,
}: OrderScheduleCardProps) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Schedule</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#007AF4]/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#007AF4]" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Pickup Date</p>
            <p className="text-sm font-medium text-slate-900">{pickupDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#007AF4]/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-[#007AF4]" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Estimated Delivery</p>
            <p className="text-sm font-medium text-slate-900">
              {estimatedDelivery}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#007AF4]/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[#007AF4]" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Delivery Zone</p>
            <p className="text-sm font-medium text-slate-900">{zone}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
