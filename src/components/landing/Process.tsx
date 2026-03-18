import React, { useEffect, useRef, useState } from "react";
import { CalendarCheck, Truck, Sparkles, PackageCheck } from "lucide-react";
import worksBg from "@/assets/works.png";

const steps = [
  {
    icon: CalendarCheck,
    step: "1",
    title: "Book Online",
    description:
      "Schedule a convenient pickup time through our website or call us directly.",
  },
  {
    icon: Truck,
    step: "2",
    title: "We Pick Up",
    description:
      "Our driver arrives at your doorstep to collect your items at the scheduled time.",
  },
  {
    icon: Sparkles,
    step: "3",
    title: "Expert Cleaning",
    description:
      "Your items go through our professional multi-stage deep cleaning process.",
  },
  {
    icon: PackageCheck,
    step: "4",
    title: "We Deliver",
    description:
      "Fresh, clean items delivered back to your doorstep, ready to use.",
  },
];

/* ── Scroll-triggered fade-in hook ─────────────────────────────── */
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
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

const Process = () => {
  const { ref: stepsRef, visible } = useRevealOnScroll();

  return (
    <section id="process" className="relative py-24 bg-white overflow-hidden">

      {/* Faded carpet background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${worksBg})`,
          opacity: 0.06,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 80%)",
        }}
      />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">

        {/* Header — centered, Services-inspired */}
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
            <span className="text-sm font-semibold text-[#2e88d1] uppercase tracking-wider">
              How It Works
            </span>
            <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Simple 4-Step Process
          </h2>
        </div>

        {/* Steps */}
        <div
          ref={stepsRef}
          className="flex flex-col items-center gap-8 lg:grid lg:grid-cols-4 lg:gap-0"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;
            return (
              <React.Fragment key={step.step}>
                <div
                  className="flex flex-col items-center text-center transition-all duration-1000 ease-out"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(24px)",
                    transitionDelay: `${index * 250}ms`,
                  }}
                >
                  {/* Circle row with connector line */}
                  <div className="relative mb-6 w-full flex justify-center">
                    {/* Dashed line extending from circle to the right — desktop */}
                    {!isLast && (
                      <div
                        className="hidden lg:block absolute top-1/2 border-t-2 border-dashed border-[#2e88d1]/25"
                        style={{ left: 'calc(50% + 52px)', right: 'calc(-50% + 52px)' }}
                      />
                    )}

                    {/* Circle */}
                    <div className="relative z-10">
                      <div className="w-24 h-24 rounded-full border-2 border-[#2e88d1]/30 flex items-center justify-center bg-white">
                        <Icon className="w-10 h-10 stroke-[1.5px] text-[#2e88d1]" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#2e88d1] text-white text-xs font-bold flex items-center justify-center shadow-md">
                        {step.step}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>

                {/* Vertical dashed connector — mobile/tablet */}
                {!isLast && (
                  <div className="lg:hidden w-0 h-8 border-l-2 border-dashed border-[#2e88d1]/25" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Process;
