import { useState, useEffect, useRef } from "react";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Layers,
  Armchair,
  Blinds,
  RectangleHorizontal,
  Sofa,
  BedDouble,
  Minus,
  Plus,
  ArrowRight,
  ShoppingCart,
  MapPin,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";

function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* Blob animation for empty state */
const BlobStyles = () => (
  <style>{`
    @keyframes pricing-blob {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    }
    @keyframes pricing-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
  `}</style>
);

const items = [
  { id: "carpet-small", icon: Layers, name: "Carpet (Small)", price: 500, unit: "per item", hint: "Up to 2m × 3m" },
  { id: "carpet-large", icon: Layers, name: "Carpet (Large)", price: 800, unit: "per item", hint: "Larger than 2m × 3m" },
  { id: "chair", icon: Armchair, name: "Chair", price: 300, unit: "per item" },
  { id: "curtain", icon: Blinds, name: "Curtain Pair", price: 400, unit: "per pair" },
  { id: "rug", icon: RectangleHorizontal, name: "Rug", price: 450, unit: "per item" },
  { id: "sofa-2seater", icon: Sofa, name: "Sofa (2-Seater)", price: 800, unit: "per item" },
  { id: "sofa-3seater", icon: Sofa, name: "Sofa (3-Seater)", price: 1200, unit: "per item" },
  { id: "mattress", icon: BedDouble, name: "Mattress", price: 600, unit: "per item" },
];

const zones = [
  { id: "kitengela", name: "Kitengela", multiplier: 1, delivery: "Same Day" },
  { id: "athiriver", name: "Athi River", multiplier: 1, delivery: "Same Day" },
  { id: "nairobi", name: "Greater Nairobi", multiplier: 1.1, delivery: "48 Hours" },
];

const PricingCalculator = () => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState(zones[0]);

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [itemId]: newValue };
    });
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + (quantities[item.id] || 0) * item.price;
  }, 0);

  const total = Math.round(subtotal * selectedZone.multiplier);
  const vat = Math.round(total * 0.16);
  const grandTotal = total + vat;

  const itemCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const { ref: contentRef, visible } = useRevealOnScroll();

  return (
    <section id="pricing" className="relative py-24 bg-white overflow-hidden">
      <BlobStyles />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">

        {/* Header */}
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
            <span className="text-sm font-semibold text-[#2e88d1] uppercase tracking-wider">
              Pricing
            </span>
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Get an Instant Quote
          </h2>
          <p className="text-slate-500 text-lg mt-3">
            Select your items and delivery zone to see your estimated price.
          </p>
        </div>

        <div
          ref={contentRef}
          className="max-w-6xl mx-auto transition-all duration-1000 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
          }}
        >

          {/* 1. Delivery Zone Pills — top */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#2e88d1]" />
              <span className="text-sm font-semibold text-slate-700">Your Delivery Area</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone)}
                  className={`p-4 rounded-[8px] text-left transition-all duration-300 ${
                    selectedZone.id === zone.id
                      ? "border-2 border-[#2e88d1] bg-[#2e88d1]/5 shadow-sm"
                      : "border border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className={`text-sm font-semibold transition-colors duration-300 ${selectedZone.id === zone.id ? "text-[#2e88d1]" : "text-slate-700"}`}>{zone.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{zone.delivery}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Item Selection */}
            <div className="lg:col-span-2">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Select Items</h3>
                  <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
                </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {items.map((item) => {
                      const quantity = quantities[item.id] || 0;
                      const active = quantity > 0;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
                            active
                              ? "border-[#2e88d1] bg-blue-50/50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                              active ? "bg-[#2e88d1]" : "bg-slate-100"
                            }`}>
                              <item.icon className={`w-5 h-5 transition-colors duration-300 ${
                                active ? "text-white" : "text-slate-400"
                              }`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <p className={`text-sm font-medium transition-colors duration-300 ${active ? "text-slate-900" : "text-slate-700"}`}>{item.name}</p>
                                {"hint" in item && item.hint && (
                                  <span className="relative group/tip">
                                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-[#2e88d1] transition-colors cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 text-xs font-medium text-white bg-slate-800 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-200">
                                      {item.hint}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">
                                KES {item.price} {item.unit}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                active
                                  ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
                                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
                              }`}
                              disabled={quantity === 0}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className={`w-8 text-center font-bold text-sm ${active ? "text-[#2e88d1]" : "text-slate-400"}`}>
                              {quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-9 h-9 rounded-lg bg-[#2e88d1] hover:bg-[#2579ba] flex items-center justify-center transition-colors duration-200"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>
            </div>

            {/* Right: Blue Receipt — bucket style */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl sticky top-24 shadow-md overflow-hidden border border-slate-200/60">
                {/* White header with foam bubbles at bottom */}
                <div className="relative bg-white px-6 pt-6 pb-14">
                  <h3 className="text-lg font-semibold text-[#2e88d1]">Your Quote</h3>
                  {/* Foam / bubble SVG transition */}
                  <svg
                    viewBox="0 -30 400 80"
                    preserveAspectRatio="none"
                    className="absolute bottom-0 left-0 w-full h-[50px] text-[#2e88d1]"
                  >
                    <circle cx="0"   cy="30" r="30" fill="currentColor" />
                    <circle cx="50"  cy="22" r="35" fill="currentColor" />
                    <circle cx="110" cy="15" r="40" fill="currentColor" />
                    <circle cx="170" cy="25" r="30" fill="currentColor" />
                    <circle cx="220" cy="12" r="42" fill="currentColor" />
                    <circle cx="280" cy="22" r="32" fill="currentColor" />
                    <circle cx="330" cy="18" r="36" fill="currentColor" />
                    <circle cx="380" cy="24" r="30" fill="currentColor" />
                    <circle cx="400" cy="22" r="25" fill="currentColor" />
                    <rect y="35" width="400" height="20" fill="currentColor" />
                  </svg>
                </div>

                {/* Blue body — the "water" in the bucket */}
                <div className="bg-[#2e88d1] px-6 pb-6 pt-2">

                {itemCount > 0 ? (
                  <div className="space-y-6">
                    {/* Line items */}
                    <div className="space-y-3">
                      {items
                        .filter((item) => quantities[item.id] > 0)
                        .map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-white/90">
                              {item.name} x {quantities[item.id]}
                            </span>
                            <span className="text-white font-medium">
                              KES {(quantities[item.id] || 0) * item.price}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="border-t border-white/20 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/90">Subtotal</span>
                        <span className="text-white">KES {total}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/90">VAT (16%)</span>
                        <span className="text-white">KES {vat}</span>
                      </div>
                      {selectedZone.multiplier > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/90">Zone Adjustment</span>
                          <span className="text-white">+10%</span>
                        </div>
                      )}
                    </div>

                    {/* Grand total */}
                    <div className="border-t border-white/20 pt-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-semibold text-white">Total</span>
                        <span className="text-2xl font-bold text-white">
                          KES {grandTotal.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-white/80 mt-1">
                        {selectedZone.delivery} delivery to {selectedZone.name}
                      </p>
                    </div>

                    <p className="text-xs text-white/70">
                      * Estimates based on standard sizes. Final price is calculated from actual item dimensions at booking.
                    </p>

                    <AnimatedButton
                      color="#fff"
                      hoverColor="#2e88d1"
                      fillColor="#ffffff"
                      bg="#d97706"
                      bordered={false}
                      className="w-full text-base py-5"
                      asChild
                    >
                      <Link to="/portal/request-pickup">
                        Schedule Pickup
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </AnimatedButton>
                  </div>
                ) : (
                  /* Empty state — floating bubble cart */
                  <div className="flex flex-col items-center py-10">
                    <div
                      className="relative w-20 h-20 flex items-center justify-center mb-5"
                      style={{ animation: "pricing-float 3s ease-in-out infinite" }}
                    >
                      <div
                        className="absolute inset-0 bg-white/15"
                        style={{
                          animation: "pricing-blob 6s ease-in-out infinite",
                          borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
                        }}
                      />
                      <ShoppingCart className="relative z-10 w-8 h-8 text-white/80" />
                    </div>
                    <p className="text-white/80 text-sm text-center">
                      Add items to see your quote
                    </p>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingCalculator;
