import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";

interface DriverInfoCardProps {
  driverName: string;
  driverPhone: string;
}

/**
 * Reusable component to display driver information
 */
export const DriverInfoCard = ({
  driverName,
  driverPhone,
}: DriverInfoCardProps) => {
  // Get initials from driver name
  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Your Driver</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">
              {initials}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{driverName}</p>
            <a
              href={`tel:${driverPhone}`}
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              <Phone className="w-3 h-3" />
              {driverPhone}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
