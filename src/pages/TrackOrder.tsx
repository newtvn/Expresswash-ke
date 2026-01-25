import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Package } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
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
 * Order Tracking Page
 * Allows customers to track their orders using a tracking code
 */
const TrackOrder = () => {
  const [trackingCode, setTrackingCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Handle order tracking
   */
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
    } catch (err) {
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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto">
          {/* Page Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              Order Tracking
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Track Your Order
            </h1>
            <p className="text-muted-foreground text-lg">
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
                className="h-12 text-base"
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              />
              <Button
                variant="hero"
                size="lg"
                onClick={handleTrack}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Track
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="text-destructive text-sm mt-3 text-center">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-3">
              Try "EW-2024-00123" for a demo
            </p>
          </div>

          {/* Order Details Section */}
          {order && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              {/* Current Status Card */}
              <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground mb-8 overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-primary-foreground/60 text-sm mb-1">
                        Current Status
                      </p>
                      <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                        {currentStage && <currentStage.icon className="w-8 h-8" />}
                        {currentStage?.name}
                      </h2>
                      <p className="text-primary-foreground/80 mt-1">
                        {currentStage?.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary-foreground/60 text-sm mb-1">
                        Tracking Code
                      </p>
                      <p className="text-xl font-mono font-bold">
                        {order.trackingCode}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Details Grid */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Timeline Section */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-6">
                        Order Progress
                      </h3>
                      <OrderTimeline currentStatus={order.status} />
                    </CardContent>
                  </Card>
                </div>

                {/* Order Info Sidebar */}
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
              <div className="w-20 h-20 rounded-full bg-secondary mx-auto mb-6 flex items-center justify-center">
                <Package className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Enter your tracking code above to view order status
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TrackOrder;
