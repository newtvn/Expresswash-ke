import { CheckCircle2 } from "lucide-react";
import { ORDER_STAGES } from "@/config/constants";

interface OrderTimelineProps {
  currentStatus: number;
}

/**
 * Reusable component to display the order progress timeline
 */
export const OrderTimeline = ({ currentStatus }: OrderTimelineProps) => {
  return (
    <div className="relative">
      {ORDER_STAGES.map((stage, index) => {
        const isCompleted = stage.id < currentStatus;
        const isCurrent = stage.id === currentStatus;
        const isPending = stage.id > currentStatus;
        const StageIcon = stage.icon;

        return (
          <div key={stage.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-success text-success-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <StageIcon className="w-5 h-5" />
                )}
              </div>
              {index < ORDER_STAGES.length - 1 && (
                <div
                  className={`w-0.5 flex-1 mt-2 ${
                    isCompleted ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isPending ? "opacity-50" : ""}`}>
              <p
                className={`font-medium ${
                  isCurrent ? "text-primary" : "text-foreground"
                }`}
              >
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
  );
};
