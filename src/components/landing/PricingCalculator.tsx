import { useState, useEffect, useRef } from "react";
import { AnimatedButton } from "@/components/ui/animated-button";
import {
  Armchair,
  BedDouble,
  Minus,
  Plus,
  ArrowRight,
  ShoppingCart,
  MapPin,
  Layers,
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
      { threshold: 0.1 }
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

// ── Rate Card Data ────────────────────────────────────────────────────

const carpetRates = [
  { type: "Non-Fluffy (Normal/Express)", pricePerSqFt: 35, pricePerSqMtr: 377 },
  { type: "Loose Fluffy",               pricePerSqFt: 40, pricePerSqMtr: 431 },
  { type: "Jute & Woolen",              pricePerSqFt: 45, pricePerSqMtr: 484 },
];

const homeCleaningRates = [
  { type: "Occupied Home",       pricePerSqFt: 12, pricePerSqMtr: 130 },
  { type: "Vacant Home",         pricePerSqFt: 8,  pricePerSqMtr: 87  },
  { type: "After Construction",  pricePerSqFt: 10, pricePerSqMtr: 108 },
];

const officeCleaningRates = [
  { type: "Non-Carpeted", pricePerSqFt: 4,  pricePerSqMtr: 38  },
  { type: "Carpeted",     pricePerSqFt: 15, pricePerSqMtr: 158 },
];

// ── Unit-Priced Items (seats + mattresses for calculator) ─────────────

const seatItems = [
  { id: "sofa-seat",    icon: Armchair,  name: "Sofa Seat",    price: 800 },
  { id: "dining-seat",  icon: Armchair,  name: "Dining Seat",  price: 300 },
  { id: "puff-seat",    icon: Armchair,  name: "Puff Seat",    price: 400 },
  { id: "arm-chair",    icon: Armchair,  name: "Arm Chair",    price: 800 },
  { id: "office-chair", icon: Armchair,  name: "Office Chair", price: 700 },
  { id: "pillow",       icon: Layers,    name: "Pillow",       price: 200 },
];

const mattressItems = [
  { id: "mattress-3x6",   icon: BedDouble, name: "Mattress 3×6 ft", price: 2000 },
  { id: "mattress-4x6",   icon: BedDouble, name: "Mattress 4×6 ft", price: 2500 },
  { id: "mattress-queen", icon: BedDouble, name: "Mattress Queen",  price: 3500 },
  { id: "mattress-king",  icon: BedDouble, name: "Mattress King",   price: 4000 },
];

const allItems = [...seatItems, ...mattressItems];

const zones = [
  { id: "kitengela", name: "Kitengela",       delivery: "Same Day" },
  { id: "athiriver", name: "Athi River",       delivery: "Same Day" },
  { id: "nairobi",   name: "Greater Nairobi",  delivery: "48 Hours" },
];

// ── Sub-components ────────────────────────────────────────────────────

const RateTable = ({
  title,
  rows,
  hasSqPricing,
}: {
  title: string;
  rows: { type: string; pricePerSqFt?: number; pricePerSqMtr?: number; price?: number }[];
  hasSqPricing: boolean;
}) => (
  <div>
    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">{title}</h4>
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0E2F60] text-white">
            <th className="text-left px-3 py-2 font-semibold">Type</th>
            {hasSqPricing ? (
              <>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">KES/sq ft</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">KES/sq mtr</th>
              </>
            ) : (
              <th className="text-right px-3 py-2 font-semibold">KES/unit</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.type} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="px-3 py-2 text-slate-700">{row.type}</td>
              {hasSqPricing ? (
                <>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{row.pricePerSqFt}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{row.pricePerSqMtr}</td>
                </>
              ) : (
                <td className="px-3 py-2 text-right font-medium text-slate-800">
                  {row.price?.toLocaleString() ?? "Request Quote"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── Seat rows for the rate table ──────────────────────────────────────
const seatRows = [
  { type: "Sofa Seat",    price: 800 },
  { type: "Dining Seat",  price: 300 },
  { type: "Puff Seat",    price: 400 },
  { type: "Arm Chair",    price: 800 },
  { type: "Office Chair", price: 700 },
  { type: "Pillows",      price: 200 },
];

const mattressRows = [
  { type: "Three by Six (3×6)",  price: 2000 },
  { type: "Four by Six (4×6)",   price: 2500 },
  { type: "Queen Size",          price: 3500 },
  { type: "King Size",           price: 4000 },
  { type: "Custom",              price: undefined },
  { type: "Bed",                 price: undefined },
];

// ── Main Component ────────────────────────────────────────────────────

const PricingCalculator = () => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState(zones[0]);
  const [tab, setTab] = useState<"calculator" | "ratecard">("calculator");

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [itemId]: newValue };
    });
  };

  const subtotal = allItems.reduce((sum, item) => sum + (quantities[item.id] || 0) * item.price, 0);
  const vat = Math.round(subtotal * 0.16);
  const grandTotal = subtotal + vat;
  const itemCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const { ref: contentRef, visible } = useRevealOnScroll();

  return (
    <section id="pricing" className="relative py-24 bg-white overflow-hidden">
      <BlobStyles />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-[#007AF4]/40" />
            <span className="text-sm font-semibold text-[#007AF4] uppercase tracking-wider">Pricing</span>
            <span className="block w-16 h-[2px] bg-[#007AF4]/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Transparent Pricing
          </h2>
          <p className="text-slate-500 text-lg mt-3">
            Affordable rates for all your carpet &amp; upholstery cleaning needs.
          </p>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setTab("calculator")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                tab === "calculator"
                  ? "bg-[#007AF4] text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Quick Quote
            </button>
            <button
              onClick={() => setTab("ratecard")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                tab === "ratecard"
                  ? "bg-[#007AF4] text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Full Rate Card
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="max-w-6xl mx-auto transition-all duration-1000 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
        >

          {/* ── RATE CARD TAB ── */}
          {tab === "ratecard" && (
            <div className="grid md:grid-cols-2 gap-6">
              <RateTable title="Carpets (Normal / Express)" rows={carpetRates} hasSqPricing />
              <RateTable title="Seats" rows={seatRows} hasSqPricing={false} />
              <RateTable title="Mattresses" rows={mattressRows} hasSqPricing={false} />
              <div className="space-y-4">
                <RateTable title="Home Cleaning" rows={homeCleaningRates} hasSqPricing />
                <RateTable title="Office Cleaning" rows={officeCleaningRates} hasSqPricing />
              </div>
              <div className="md:col-span-2 bg-[#0E2F60]/5 border border-[#0E2F60]/20 rounded-xl p-4 text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold text-[#0E2F60]">NORMAL:</span> Best effort is put to meet 24 hrs service turn around.</p>
                <p><span className="font-semibold text-[#007AF4]">EXPRESS:</span> Service turn around is within 24 hrs without fail.</p>
                <p className="pt-1 text-xs text-slate-400">All prices in KES. VAT (16%) applicable. Custom &amp; Bed sizes — request a quote.</p>
              </div>
            </div>
          )}

          {/* ── QUICK QUOTE CALCULATOR TAB ── */}
          {tab === "calculator" && (
            <>
              {/* Delivery Zone Pills */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-[#007AF4]" />
                  <span className="text-sm font-semibold text-slate-700">Your Delivery Area</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {zones.map((zone) => (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZone(zone)}
                      className={`p-4 rounded-[8px] text-left transition-all duration-300 ${
                        selectedZone.id === zone.id
                          ? "border-2 border-[#007AF4] bg-[#007AF4]/5 shadow-sm"
                          : "border border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className={`text-sm font-semibold transition-colors duration-300 ${selectedZone.id === zone.id ? "text-[#007AF4]" : "text-slate-700"}`}>
                        {zone.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{zone.delivery}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Item Selection */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Seats */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Seats &amp; Upholstery</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {seatItems.map((item) => {
                        const quantity = quantities[item.id] || 0;
                        const active = quantity > 0;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
                              active ? "border-[#007AF4] bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${active ? "bg-[#007AF4]" : "bg-slate-100"}`}>
                                <item.icon className={`w-5 h-5 transition-colors duration-300 ${active ? "text-white" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>{item.name}</p>
                                <p className="text-xs text-slate-400">KES {item.price.toLocaleString()} / unit</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                disabled={quantity === 0}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${active ? "bg-slate-200 hover:bg-slate-300 text-slate-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className={`w-7 text-center font-bold text-sm ${active ? "text-[#007AF4]" : "text-slate-400"}`}>{quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-[#007AF4] hover:bg-[#005FCC] flex items-center justify-center transition-colors duration-200"
                              >
                                <Plus className="w-3.5 h-3.5 text-white" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mattresses */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Mattresses</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {mattressItems.map((item) => {
                        const quantity = quantities[item.id] || 0;
                        const active = quantity > 0;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${
                              active ? "border-[#007AF4] bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${active ? "bg-[#007AF4]" : "bg-slate-100"}`}>
                                <item.icon className={`w-5 h-5 transition-colors duration-300 ${active ? "text-white" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>{item.name}</p>
                                <p className="text-xs text-slate-400">KES {item.price.toLocaleString()} / unit</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                disabled={quantity === 0}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${active ? "bg-slate-200 hover:bg-slate-300 text-slate-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className={`w-7 text-center font-bold text-sm ${active ? "text-[#007AF4]" : "text-slate-400"}`}>{quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-[#007AF4] hover:bg-[#005FCC] flex items-center justify-center transition-colors duration-200"
                              >
                                <Plus className="w-3.5 h-3.5 text-white" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    * Carpet cleaning is priced per sq ft — see Full Rate Card above. Final price is confirmed at booking.
                  </p>
                </div>

                {/* Right: Quote Receipt */}
                <div className="lg:col-span-1">
                  <div className="rounded-2xl sticky top-24 shadow-md overflow-hidden border border-slate-200/60">
                    {/* White header with foam bubbles */}
                    <div className="relative bg-white px-6 pt-6 pb-14">
                      <h3 className="text-lg font-semibold text-[#007AF4]">Your Quote</h3>
                      <svg viewBox="0 -30 400 80" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-[50px] text-[#007AF4]">
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

                    {/* Blue body */}
                    <div className="bg-[#007AF4] px-6 pb-6 pt-2">
                      {itemCount > 0 ? (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            {allItems
                              .filter((item) => quantities[item.id] > 0)
                              .map((item) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                  <span className="text-white/90">{item.name} × {quantities[item.id]}</span>
                                  <span className="text-white font-medium">
                                    KES {((quantities[item.id] || 0) * item.price).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                          </div>

                          <div className="border-t border-white/20 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/90">Subtotal</span>
                              <span className="text-white">KES {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/90">VAT (16%)</span>
                              <span className="text-white">KES {vat.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="border-t border-white/20 pt-4">
                            <div className="flex justify-between items-baseline">
                              <span className="text-lg font-semibold text-white">Total</span>
                              <span className="text-2xl font-bold text-white">KES {grandTotal.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-white/80 mt-1">
                              {selectedZone.delivery} delivery to {selectedZone.name}
                            </p>
                          </div>

                          <p className="text-xs text-white/70">
                            * Estimates for seats &amp; mattresses. Carpet pricing is per sq ft — get exact quote at booking.
                          </p>

                          <AnimatedButton
                            color="#fff"
                            hoverColor="#007AF4"
                            fillColor="#ffffff"
                            bg="#F4743B"
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
                        <div className="flex flex-col items-center py-10">
                          <div
                            className="relative w-20 h-20 flex items-center justify-center mb-5"
                            style={{ animation: "pricing-float 3s ease-in-out infinite" }}
                          >
                            <div
                              className="absolute inset-0 bg-white/15"
                              style={{ animation: "pricing-blob 6s ease-in-out infinite", borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }}
                            />
                            <ShoppingCart className="relative z-10 w-8 h-8 text-white/80" />
                          </div>
                          <p className="text-white/80 text-sm text-center">
                            Add seats or mattresses to see your quote
                          </p>
                          <button
                            onClick={() => setTab("ratecard")}
                            className="mt-3 text-xs text-white/60 underline underline-offset-2 hover:text-white/90 transition-colors"
                          >
                            View carpet &amp; full rate card
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PricingCalculator;
