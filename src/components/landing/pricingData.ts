import { Armchair, BedDouble, Layers } from "lucide-react";

export const carpetRates = [
  { type: "Non-Fluffy (Normal/Express)", pricePerSqFt: 35, pricePerSqMtr: 377 },
  { type: "Loose Fluffy", pricePerSqFt: 40, pricePerSqMtr: 431 },
  { type: "Jute & Woolen", pricePerSqFt: 45, pricePerSqMtr: 484 },
];

export const homeCleaningRates = [
  { type: "Occupied Home", pricePerSqFt: 12, pricePerSqMtr: 130 },
  { type: "Vacant Home", pricePerSqFt: 8, pricePerSqMtr: 87 },
  { type: "After Construction", pricePerSqFt: 10, pricePerSqMtr: 108 },
];

export const officeCleaningRates = [
  { type: "Non-Carpeted", pricePerSqFt: 4, pricePerSqMtr: 38 },
  { type: "Carpeted", pricePerSqFt: 15, pricePerSqMtr: 158 },
];

export const seatItems = [
  { id: "sofa-seat", icon: Armchair, name: "Sofa Seat", price: 800 },
  { id: "dining-seat", icon: Armchair, name: "Dining Seat", price: 300 },
  { id: "puff-seat", icon: Armchair, name: "Puff Seat", price: 400 },
  { id: "arm-chair", icon: Armchair, name: "Arm Chair", price: 800 },
  { id: "office-chair", icon: Armchair, name: "Office Chair", price: 700 },
  { id: "pillow", icon: Layers, name: "Pillow", price: 200 },
];

export const mattressItems = [
  { id: "mattress-3x6", icon: BedDouble, name: "Mattress 3×6 ft", price: 2000 },
  { id: "mattress-4x6", icon: BedDouble, name: "Mattress 4×6 ft", price: 2500 },
  { id: "mattress-queen", icon: BedDouble, name: "Mattress Queen", price: 3500 },
  { id: "mattress-king", icon: BedDouble, name: "Mattress King", price: 4000 },
];

export const allItems = [...seatItems, ...mattressItems];

export const zones = [
  { id: "kitengela", name: "Kitengela", delivery: "24 Hours" },
  { id: "athiriver", name: "Athi River", delivery: "24 Hours" },
];

export const seatRows = [
  { type: "Sofa Seat", price: 800 },
  { type: "Dining Seat", price: 300 },
  { type: "Puff Seat", price: 400 },
  { type: "Arm Chair", price: 800 },
  { type: "Office Chair", price: 700 },
  { type: "Pillows", price: 200 },
];

export const mattressRows = [
  { type: "Three by Six (3×6)", price: 2000 },
  { type: "Four by Six (4×6)", price: 2500 },
  { type: "Queen Size", price: 3500 },
  { type: "King Size", price: 4000 },
  { type: "Custom", price: undefined },
  { type: "Bed", price: undefined },
];
