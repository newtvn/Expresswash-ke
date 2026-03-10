import { OrderItem } from "@/types";

interface OrderItemsCardProps {
  items: OrderItem[];
}

/**
 * Reusable component to display order items in a card
 */
export const OrderItemsCard = ({ items }: OrderItemsCardProps) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Items</h3>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between text-sm">
            <span className="text-slate-500">{item.name}</span>
            <span className="font-medium text-slate-900">
              x{item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
