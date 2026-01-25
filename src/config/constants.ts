import { 
  Clock, 
  Package, 
  CheckCircle2, 
  Truck, 
  Droplets, 
  Wind, 
  Sparkles, 
  PackageCheck, 
  MapPin 
} from "lucide-react";

/**
 * Configuration for the 12-stage order tracking pipeline
 */
export const ORDER_STAGES = [
  { 
    id: 1, 
    name: "Pending Quote", 
    icon: Clock, 
    description: "Awaiting price confirmation" 
  },
  { 
    id: 2, 
    name: "Quote Sent", 
    icon: Package, 
    description: "Quote sent to customer" 
  },
  { 
    id: 3, 
    name: "Quote Accepted", 
    icon: CheckCircle2, 
    description: "Customer accepted quote" 
  },
  { 
    id: 4, 
    name: "Pickup Scheduled", 
    icon: Clock, 
    description: "Pickup time confirmed" 
  },
  { 
    id: 5, 
    name: "Picked Up", 
    icon: Truck, 
    description: "Items collected" 
  },
  { 
    id: 6, 
    name: "In Washing", 
    icon: Droplets, 
    description: "Being cleaned" 
  },
  { 
    id: 7, 
    name: "Drying", 
    icon: Wind, 
    description: "Items drying" 
  },
  { 
    id: 8, 
    name: "Quality Check", 
    icon: Sparkles, 
    description: "Inspection in progress" 
  },
  { 
    id: 9, 
    name: "Ready for Dispatch", 
    icon: PackageCheck, 
    description: "Prepared for delivery" 
  },
  { 
    id: 10, 
    name: "Dispatched", 
    icon: Truck, 
    description: "On the way" 
  },
  { 
    id: 11, 
    name: "Out for Delivery", 
    icon: MapPin, 
    description: "Near your location" 
  },
  { 
    id: 12, 
    name: "Delivered", 
    icon: CheckCircle2, 
    description: "Successfully delivered" 
  },
];

/**
 * Service zones configuration
 */
export const SERVICE_ZONES = [
  { id: "kitengela", name: "Kitengela" },
  { id: "syokimau", name: "Syokimau & Mlolongo" },
  { id: "athi-river", name: "Athi River" },
] as const;

/**
 * Company information
 */
export const COMPANY_INFO = {
  name: "ExpressWash",
  tagline: "Professional Carpet & Fabric Care",
  phone: "+254 712 345 678",
  email: "info@expresswash.co.ke",
  address: "Kitengela, Kenya",
} as const;
