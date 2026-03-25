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
  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Driver</h3>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#007AF4]/10 flex items-center justify-center">
          <span className="text-lg font-semibold text-[#007AF4]">
            {initials}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-900">{driverName}</p>
          <a
            href={`tel:${driverPhone}`}
            className="text-sm text-[#007AF4] flex items-center gap-1 hover:underline"
          >
            <Phone className="w-3 h-3" />
            {driverPhone}
          </a>
        </div>
      </div>
    </div>
  );
};
