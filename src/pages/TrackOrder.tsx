import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  Package,
  Truck,
  Sparkles,
  Droplets,
  Wind,
  CheckCircle2,
  PackageCheck,
  ArrowRight,
  Clock,
  MapPin,
  Phone
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// 12-stage order pipeline
const orderStages = [
  { id: 1, name: "Pending Quote", icon: Clock, description: "Awaiting price confirmation" },
  { id: 2, name: "Quote Sent", icon: Package, description: "Quote sent to customer" },
  { id: 3, name: "Quote Accepted", icon: CheckCircle2, description: "Customer accepted quote" },
  { id: 4, name: "Pickup Scheduled", icon: Clock, description: "Pickup time confirmed" },
  { id: 5, name: "Picked Up", icon: Truck, description: "Items collected" },
  { id: 6, name: "In Washing", icon: Droplets, description: "Being cleaned" },
  { id: 7, name: "Drying", icon: Wind, description: "Items drying" },
  { id: 8, name: "Quality Check", icon: Sparkles, description: "Inspection in progress" },
  { id: 9, name: "Ready for Dispatch", icon: PackageCheck, description: "Prepared for delivery" },
  { id: 10, name: "Dispatched", icon: Truck, description: "On the way" },
  { id: 11, name: "Out for Delivery", icon: MapPin, description: "Near your location" },
  { id: 12, name: "Delivered", icon: CheckCircle2, description: "Successfully delivered" },
];

// Demo order data
const demoOrder = {
  trackingCode: "EW-2024-00123",
  customerName: "Grace Wanjiku",
  status: 8,
  items: [
    { name: "Carpet (Large)", quantity: 2 },
    { name: "Sofa (3-Seater)", quantity: 1 },
    { name: "Curtain Pair", quantity: 3 },
  ],
  pickupDate: "Jan 22, 2024",
  estimatedDelivery: "Jan 24, 2024",
  zone: "Kitengela",
  driverName: "Joseph Mwangi",
  driverPhone: "+254 712 345 678",
};

const TrackOrder = () => {
  const [trackingCode, setTrackingCode] = useState("");
  const [order, setOrder] = useState<typeof demoOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrack = () => {
    setIsLoading(true);
    setError("");
    
    // Simulate API call
    setTimeout(() => {
      if (trackingCode.toUpperCase() === "EW-2024-00123" || trackingCode === "") {
        setOrder(demoOrder);
      } else {
        setError("Order not found. Please check your tracking code.");
        setOrder(null);
      }
      setIsLoading(false);
    }, 1000);
  };

  const currentStage = order ? orderStages.find(s => s.id === order.status) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Order Tracking</span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
              Track Your Order
            </h1>
            <p className="text-muted-foreground text-lg">
              Enter your tracking code to see real-time status updates.
            </p>
          </div>

          {/* Search */}
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
              <p className="text-destructive text-sm mt-3 text-center">{error}</p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-3">
              Try "EW-2024-00123" for a demo
            </p>
          </div>

          {/* Order Details */}
          {order && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              {/* Current Status Card */}
              <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground mb-8 overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-primary-foreground/60 text-sm mb-1">Current Status</p>
                      <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                        {currentStage && <currentStage.icon className="w-8 h-8" />}
                        {currentStage?.name}
                      </h2>
                      <p className="text-primary-foreground/80 mt-1">
                        {currentStage?.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary-foreground/60 text-sm mb-1">Tracking Code</p>
                      <p className="text-xl font-mono font-bold">{order.trackingCode}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Timeline */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Order Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        {orderStages.map((stage, index) => {
                          const isCompleted = stage.id < order.status;
                          const isCurrent = stage.id === order.status;
                          const isPending = stage.id > order.status;
                          
                          return (
                            <div key={stage.id} className="flex gap-4 pb-6 last:pb-0">
                              {/* Line */}
                              <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                  isCompleted 
                                    ? "bg-success text-success-foreground" 
                                    : isCurrent 
                                      ? "bg-primary text-primary-foreground shadow-glow"
                                      : "bg-secondary text-muted-foreground"
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                  ) : (
                                    <stage.icon className="w-5 h-5" />
                                  )}
                                </div>
                                {index < orderStages.length - 1 && (
                                  <div className={`w-0.5 flex-1 mt-2 ${
                                    isCompleted ? "bg-success" : "bg-border"
                                  }`} />
                                )}
                              </div>
                              
                              {/* Content */}
                              <div className={`flex-1 pb-4 ${isPending ? "opacity-50" : ""}`}>
                                <p className={`font-medium ${
                                  isCurrent ? "text-primary" : "text-foreground"
                                }`}>
                                  {stage.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {stage.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Order Info */}
                <div className="space-y-6">
                  {/* Items */}
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {order.items.map((item, index) => (
                          <li key={index} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-medium text-foreground">x{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Dates */}
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Schedule</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pickup Date</p>
                          <p className="text-sm font-medium text-foreground">{order.pickupDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                          <p className="text-sm font-medium text-foreground">{order.estimatedDelivery}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Delivery Zone</p>
                          <p className="text-sm font-medium text-foreground">{order.zone}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Driver Info */}
                  {order.status >= 10 && (
                    <Card className="bg-card border-border/50">
                      <CardHeader>
                        <CardTitle className="text-lg">Your Driver</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-primary">JM</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{order.driverName}</p>
                            <a 
                              href={`tel:${order.driverPhone}`}
                              className="text-sm text-primary flex items-center gap-1 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {order.driverPhone}
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
