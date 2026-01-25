import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderItem } from "@/types";

interface OrderItemsCardProps {
  items: OrderItem[];
}

/**
 * Reusable component to display order items in a card
 */
export const OrderItemsCard = ({ items }: OrderItemsCardProps) => {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Items</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium text-foreground">
                x{item.quantity}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
