import { useState, useEffect, useRef } from "react";
import { AnimatedButton } from "@/components/ui/animated-button";
import {
  Minus,
  Plus,
  ArrowRight,
  ShoppingCart,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PricingArtworkStyles, PricingRibbonBackdrop } from "./PricingArtwork";
import {
  allItems,
  carpetRates,
  homeCleaningRates,
  mattressItems,
  mattressRows,
  officeCleaningRates,
  seatItems,
  seatRows,
  zones,
} from "./pricingData";

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
    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-blue">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
      {title}
    </h4>
    <div className="overflow-x-auto rounded-lg border border-brand-blue/20 shadow-[0_5px_16px_rgba(0,122,244,0.06)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-blue text-white">
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
            <tr key={row.type} className={i % 2 === 0 ? "bg-white" : "bg-brand-blue/[0.045]"}>
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

// ── Main Component ────────────────────────────────────────────────────

const PricingCalculator = () => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState(zones[0]);
  const [tab, setTab] = useState<"calculator" | "ratecard">("calculator");
  const [ribbonProgress, setRibbonProgress] = useState(0);
  const pricingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const section = pricingRef.current;
      if (!section) return;

      const bounds = section.getBoundingClientRect();
      const startLine = window.innerHeight * 0.88;
      const travel = bounds.height + window.innerHeight * 0.72;
      const nextProgress = Math.min(1, Math.max(0, (startLine - bounds.top) / travel));

      setRibbonProgress((current) =>
        Math.abs(current - nextProgress) < 0.001 ? current : nextProgress,
      );
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [tab]);

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
    <section ref={pricingRef} id="pricing" className="relative py-24 bg-white overflow-hidden">
      <PricingArtworkStyles />
      <PricingRibbonBackdrop progress={ribbonProgress} />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-brand-orange/40" />
            <span className="text-sm font-semibold text-brand-orange uppercase tracking-wider">Pricing</span>
            <span className="block w-16 h-[2px] bg-brand-orange/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Transparent Pricing
          </h2>
          <p className="text-slate-500 text-lg mt-3">
            Affordable rates for all your carpet &amp; upholstery cleaning needs.
          </p>
          <p className="inline-flex items-center gap-2 mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5">
            <span>⚠️</span>
            Prices shown are <strong>minimum starting rates</strong> — final price varies with the size of the item.
          </p>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setTab("calculator")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                tab === "calculator"
                  ? "bg-brand-orange text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Quick Quote
            </button>
            <button
              onClick={() => setTab("ratecard")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                tab === "ratecard"
                  ? "bg-brand-orange text-white shadow"
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
              <div className="md:col-span-2 bg-brand-orange/5 border border-brand-orange/30 rounded-xl p-4 text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold text-brand-blue">NORMAL:</span> Best effort is put to meet 24 hrs service turn around.</p>
                <p><span className="font-semibold text-brand-blue">EXPRESS:</span> Service turn around is within 24 hrs without fail. <span className="text-brand-orange font-semibold">+KES 1,000 surcharge.</span></p>
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
                  <MapPin className="w-4 h-4 text-brand-blue" />
                  <span className="text-sm font-semibold text-slate-700">Your Delivery Area</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {zones.map((zone) => (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZone(zone)}
                      className={`p-4 rounded-[8px] text-left transition-all duration-300 ${
                        selectedZone.id === zone.id
                          ? "border-2 border-brand-blue bg-brand-blue/5 shadow-sm"
                          : "border border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className={`text-sm font-semibold transition-colors duration-300 ${selectedZone.id === zone.id ? "text-brand-blue" : "text-slate-700"}`}>
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
                              active ? "border-brand-blue bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${active ? "bg-brand-blue" : "bg-slate-100"}`}>
                                <item.icon className={`w-5 h-5 transition-colors duration-300 ${active ? "text-white" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>{item.name}</p>
                                <p className="text-xs text-slate-400">from KES {item.price.toLocaleString()} / unit <span className="text-amber-500 italic">· price varies by size</span></p>
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
                              <span className={`w-7 text-center font-bold text-sm ${active ? "text-brand-blue" : "text-slate-400"}`}>{quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-brand-blue hover:bg-[#005FCC] flex items-center justify-center transition-colors duration-200"
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
                              active ? "border-brand-blue bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${active ? "bg-brand-blue" : "bg-slate-100"}`}>
                                <item.icon className={`w-5 h-5 transition-colors duration-300 ${active ? "text-white" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-700"}`}>{item.name}</p>
                                <p className="text-xs text-slate-400">from KES {item.price.toLocaleString()} / unit <span className="text-amber-500 italic">· price varies by size</span></p>
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
                              <span className={`w-7 text-center font-bold text-sm ${active ? "text-brand-blue" : "text-slate-400"}`}>{quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-brand-blue hover:bg-[#005FCC] flex items-center justify-center transition-colors duration-200"
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
                  <div className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-md">
                    {/* Heading + empty state — white area that shrinks as the quote fills up */}
                    <div className="relative z-10 flex flex-1 flex-col px-6 pt-6">
                      <h3 className="text-lg font-semibold text-brand-blue">Your Quote</h3>
                      {itemCount === 0 && (
                        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                          <div
                            className="relative mb-5 flex h-20 w-20 items-center justify-center"
                            style={{ animation: "pricing-float 3s ease-in-out infinite" }}
                          >
                            <div
                              className="absolute inset-0 bg-brand-blue/10"
                              style={{ animation: "pricing-blob 6s ease-in-out infinite", borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }}
                            />
                            <ShoppingCart className="relative z-10 h-8 w-8 text-brand-blue/50" />
                          </div>
                          <p className="text-sm text-slate-500">Add seats or mattresses to see your quote</p>
                          <button
                            onClick={() => setTab("ratecard")}
                            className="mt-3 text-xs text-brand-blue/70 underline underline-offset-2 transition-colors hover:text-brand-blue"
                          >
                            View carpet &amp; full rate card
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Blue liquid fill — grows from the bottom as items are added; bubbly wave surface */}
                    <div className="relative z-[1] bg-brand-blue px-6 pb-6 pt-2 text-white">
                      <svg viewBox="0 -30 400 80" preserveAspectRatio="none" className="absolute -top-6 left-0 h-8 w-full text-brand-blue" aria-hidden="true">
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
                      <span className="absolute -top-8 left-8 h-2.5 w-2.5 rounded-full bg-brand-blue/60" aria-hidden="true" />
                      <span className="absolute -top-12 left-16 h-1.5 w-1.5 rounded-full bg-brand-blue/40" aria-hidden="true" />
                      <span className="absolute -top-9 right-10 h-2 w-2 rounded-full bg-brand-blue/50" aria-hidden="true" />

                      {itemCount > 0 ? (
                        <div className="relative space-y-6">
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
                        <div className="h-2" />
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
