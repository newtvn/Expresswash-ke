import {
  Armchair,
  BedDouble,
  Blinds,
  Layers,
  RectangleHorizontal,
  Sofa,
  type LucideIcon,
} from "lucide-react";

export interface ServiceDefinition {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const services: ServiceDefinition[] = [
  {
    icon: Layers,
    title: "Carpet Cleaning",
    description: "Deep carpet cleaning for all types and sizes — carpets wash, stain removal & deodorizing",
  },
  {
    icon: Armchair,
    title: "Chair Washing",
    description: "Fabric and leather chair washing — dining chairs, office chairs & accent seats",
  },
  {
    icon: Blinds,
    title: "Curtain Washing",
    description: "Gentle curtain washing for all fabric types — silk, linen & blackout curtains",
  },
  {
    icon: RectangleHorizontal,
    title: "Rug & Rags Cleaning",
    description: "Specialized rug washing and rags cleaning — area rugs, oriental rugs & decorative pieces",
  },
  {
    icon: Sofa,
    title: "Sofa Cleaning",
    description: "Complete sofa washing & upholstery cleaning — sofas, loveseats & sectionals",
  },
  {
    icon: BedDouble,
    title: "Mattress Cleaning",
    description: "Deep mattress sanitization, dust mite removal & stain extraction",
  },
];
