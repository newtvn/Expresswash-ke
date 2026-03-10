import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { AnimatedButton } from "@/components/ui/animated-button";
import CTA from "@/components/landing/CTA";
import {
  OrderTimeline,
  OrderItemsCard,
  OrderScheduleCard,
  DriverInfoCard,
} from "@/components/order";
import { trackOrder } from "@/services/orderService";
import { Order } from "@/types";
import { ORDER_STAGES } from "@/config/constants";

/**
 * Public Order Tracking Page
 * Allows customers to track their orders using a tracking code.
 * No Header/Footer -- PublicLayout handles that.
 */
const TrackOrder = () => {
  const [trackingCode, setTrackingCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrack = async () => {
    if (!trackingCode.trim()) {
      setError("Please enter a tracking code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await trackOrder(trackingCode);

      if (response.success && response.order) {
        setOrder(response.order);
      } else {
        setError(response.error || "Failed to track order");
        setOrder(null);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStage = order
    ? ORDER_STAGES.find((s) => s.id === order.status)
    : null;

  return (
    <main className="flex-1 bg-slate-50 pt-24 pb-16">
      <div className="container mx-auto max-w-7xl px-6">

        {/* Page Header — matching landing page pattern */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
            <span className="text-sm font-semibold text-[#2e88d1] uppercase tracking-wider">
              Order Tracking
            </span>
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mt-3 mb-4">
            Track Your Order
          </h1>
          <p className="text-slate-500 text-lg">
            Enter your tracking code to see real-time status updates.
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="flex gap-3">
            <Input
              placeholder="Enter tracking code (e.g., EW-2024-00123)"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="h-12 text-base rounded-xl border-slate-200 focus:border-[#2e88d1] focus:ring-[#2e88d1]/20"
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            />
            <AnimatedButton
              color="#fff"
              hoverColor="#fff"
              fillColor="#000000"
              bg="#2e88d1"
              bordered={false}
              className="h-12 px-6 text-base shrink-0"
              onClick={handleTrack}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 mr-1.5" />
                  Track
                </>
              )}
            </AnimatedButton>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-3 text-center">
              {error}
            </p>
          )}
          <p className="text-xs text-slate-400 text-center mt-3">
            Enter a tracking code like &ldquo;EW-2026-XXXXX&rdquo; from your order confirmation
          </p>
        </div>

        {/* Order Details Section */}
        {order && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Current Status Card */}
            <div className="relative bg-[#2e88d1] rounded-2xl p-8 mb-8 overflow-hidden text-white">
              {/* Decorative bubbles */}
              <div className="absolute top-4 left-6 w-24 h-24 rounded-full bg-white/[0.05]" />
              <div className="absolute bottom-6 right-8 w-32 h-32 rounded-full bg-white/[0.04]" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-white/60 text-sm mb-1">
                    Current Status
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                    {currentStage && (
                      <currentStage.icon className="w-8 h-8" />
                    )}
                    {currentStage?.name}
                  </h2>
                  <p className="text-white/80 mt-1">
                    {currentStage?.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-sm mb-1">
                    Tracking Code
                  </p>
                  <p className="text-xl font-mono font-bold">
                    {order.trackingCode}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Details Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-6">
                    Order Progress
                  </h3>
                  <OrderTimeline currentStatus={order.status} />
                </div>
              </div>

              <div className="space-y-6">
                <OrderItemsCard items={order.items} />
                <OrderScheduleCard
                  pickupDate={order.pickupDate}
                  estimatedDelivery={order.estimatedDelivery}
                  zone={order.zone}
                />
                {order.status >= 10 && order.driverName && order.driverPhone && (
                  <DriverInfoCard
                    driverName={order.driverName}
                    driverPhone={order.driverPhone}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!order && !error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-[#2e88d1]/10 mx-auto mb-6 flex items-center justify-center">
              <Package className="w-10 h-10 text-[#2e88d1]" />
            </div>
            <p className="text-slate-500">
              Enter your tracking code above to view order status
            </p>
          </div>
        )}
      </div>

      {/* Pre-footer CTA */}
      <CTA />
    </main>
  );
};

export default TrackOrder;
