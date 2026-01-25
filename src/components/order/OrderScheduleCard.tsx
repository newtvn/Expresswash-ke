import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <p className="text-sm font-medium text-foreground">{pickupDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated Delivery</p>
            <p className="text-sm font-medium text-foreground">
              {estimatedDelivery}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <MapPin className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Delivery Zone</p>
            <p className="text-sm font-medium text-foreground">{zone}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
