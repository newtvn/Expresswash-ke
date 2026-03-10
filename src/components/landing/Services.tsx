import {
  Armchair,
  Layers,
  BedDouble,
  Blinds,
  Sofa,
  RectangleHorizontal,
} from "lucide-react";

/* ───────────────────────────────────────────────────────────────────
   1. CUSTOM ANIMATIONS
   ─────────────────────────────────────────────────────────────────── */
const CustomStyles = () => (
  <style>{`
    @keyframes blob-shape {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    }
    @keyframes subtle-float {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-2px) rotate(2deg); }
    }
    @keyframes subtle-float-reverse {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(2px) rotate(-2deg); }
    }
    .animate-blob-shape {
      animation: blob-shape 6s ease-in-out infinite;
    }
    .animate-subtle-float {
      animation: subtle-float 4s ease-in-out infinite;
    }
    .animate-subtle-float-reverse {
      animation: subtle-float-reverse 5s ease-in-out infinite;
    }
  `}</style>
);

/* ───────────────────────────────────────────────────────────────────
   2. FOAM / BUBBLE TRANSITION SVG (Updated to match inspiration)
   ─────────────────────────────────────────────────────────────────── */
const FoamTransition = () => (
  <div className="relative w-full z-30 overflow-hidden" style={{ marginTop: -110, marginBottom: -1 }}>
    <svg
      viewBox="0 -60 1440 220"
      preserveAspectRatio="none"
      className="block w-full text-[#f2f8fc]"
      style={{ height: 120 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Solid foam base ───────────────────────────────────────── */}
      <rect y="90" width="1440" height="70" fill="currentColor" />

      {/* ── Main cloud humps ──────────────────────────────────────── */}
      <circle cx="0"    cy="100" r="40"  fill="currentColor" />
      <circle cx="90"   cy="95"  r="50"  fill="currentColor" />
      <circle cx="210"  cy="80"  r="75"  fill="currentColor" />
      <circle cx="340"  cy="90"  r="55"  fill="currentColor" />
      <circle cx="500"  cy="55"  r="100" fill="currentColor" />
      <circle cx="660"  cy="85"  r="60"  fill="currentColor" />
      <circle cx="780"  cy="95"  r="45"  fill="currentColor" />
      <circle cx="920"  cy="65"  r="85"  fill="currentColor" />
      <circle cx="1080" cy="90"  r="55"  fill="currentColor" />
      <circle cx="1250" cy="50"  r="105" fill="currentColor" />
      <circle cx="1400" cy="85"  r="60"  fill="currentColor" />
      <circle cx="1440" cy="100" r="40"  fill="currentColor" />

      {/* ── Gap fillers along the base ────────────────────────────── */}
      <circle cx="140"  cy="100" r="30" fill="currentColor" />
      <circle cx="280"  cy="100" r="30" fill="currentColor" />
      <circle cx="420"  cy="100" r="30" fill="currentColor" />
      <circle cx="590"  cy="100" r="30" fill="currentColor" />
      <circle cx="720"  cy="100" r="30" fill="currentColor" />
      <circle cx="850"  cy="100" r="30" fill="currentColor" />
      <circle cx="1010" cy="100" r="30" fill="currentColor" />
      <circle cx="1160" cy="100" r="30" fill="currentColor" />
      <circle cx="1340" cy="100" r="30" fill="currentColor" />

    </svg>

    {/* ── Floating bubbles (outside SVG so they stay circular) ──── */}
    <div className="absolute w-3 h-3 rounded-full bg-[#f2f8fc]" style={{ left: '8%', top: '10%' }} />
    <div className="absolute w-5 h-5 rounded-full bg-[#f2f8fc]" style={{ left: '11%', top: '2%' }} />
    <div className="absolute w-2 h-2 rounded-full bg-[#f2f8fc]" style={{ left: '14%', top: '18%' }} />

    <div className="absolute w-4 h-4 rounded-full bg-[#f2f8fc]" style={{ left: '35%', top: '8%' }} />
    <div className="absolute w-2.5 h-2.5 rounded-full bg-[#f2f8fc]" style={{ left: '38%', top: '20%' }} />

    <div className="absolute w-3 h-3 rounded-full bg-[#f2f8fc]" style={{ left: '62%', top: '5%' }} />

    <div className="absolute w-6 h-6 rounded-full bg-[#f2f8fc]" style={{ left: '86%', top: '3%' }} />
    <div className="absolute w-3 h-3 rounded-full bg-[#f2f8fc]" style={{ left: '90%', top: '15%' }} />
    <div className="absolute w-2 h-2 rounded-full bg-[#f2f8fc]" style={{ left: '93%', top: '8%' }} />
  </div>
);

/* ───────────────────────────────────────────────────────────────────
   3. SERVICES DATA
   ─────────────────────────────────────────────────────────────────── */
const services = [
  {
    icon: Layers,
    title: "Carpets",
    description: "Deep cleaning for all carpet types and sizes",
    price: "From KES 500",
  },
  {
    icon: Armchair,
    title: "Chairs",
    description: "Fabric and leather chair cleaning",
    price: "From KES 300",
  },
  {
    icon: Blinds,
    title: "Curtains",
    description: "Gentle cleaning for all fabric types",
    price: "From KES 200",
  },
  {
    icon: RectangleHorizontal,
    title: "Rugs",
    description: "Specialized rug care and restoration",
    price: "From KES 400",
  },
  {
    icon: Sofa,
    title: "Sofas",
    description: "Complete sofa and upholstery cleaning",
    price: "From KES 800",
  },
  {
    icon: BedDouble,
    title: "Mattresses",
    description: "Deep sanitization and stain removal",
    price: "From KES 600",
  },
];

/* ───────────────────────────────────────────────────────────────────
   4. MAIN SERVICES COMPONENT
   ─────────────────────────────────────────────────────────────────── */
const Services = () => {
  return (
    <>
      {/* Foam transition from Hero into Services */}
      <FoamTransition />

      <section id="services" className="pt-12 pb-24 bg-[#f2f8fc]">
        <CustomStyles />

        <div className="container mx-auto max-w-7xl px-6 relative z-10">

          {/* Header */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-[#2e88d1] uppercase tracking-wider">
                Our Services
              </span>
              <span className="block w-16 h-[2px] bg-[#2e88d1]/40" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              What We Clean
            </h2>
          </div>

          {/* 3x2 Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.title}
                  className="animated-card group bg-white p-8 rounded-[5px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col items-center text-center"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Wave-fill spans */}
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />

                  {/* Blob & Icon Container */}
                  <div className="relative flex items-center justify-center w-24 h-24 mb-6 z-20 transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="absolute top-1 -right-2 w-4 h-4 bg-slate-200 group-hover:bg-white/50 rounded-full animate-subtle-float transition-colors duration-300"></div>
                    <div className="absolute bottom-2 -left-2 w-3 h-3 bg-slate-200 group-hover:bg-white/50 rounded-full animate-subtle-float-reverse transition-colors duration-300" style={{ animationDelay: '1.5s' }}></div>
                    <div className="absolute inset-2 bg-slate-100 group-hover:bg-white group-hover:shadow-lg animate-blob-shape transition-all duration-300"></div>
                    <Icon className="relative z-10 w-10 h-10 stroke-[1.5px] text-slate-800 group-hover:text-[#2e88d1] transition-colors duration-300" />
                  </div>

                  {/* Text Content */}
                  <h3 className="text-xl font-bold mb-3 text-[#2e88d1] group-hover:text-white transition-colors duration-500 z-10">
                    {service.title}
                  </h3>
                  <p className="mb-8 flex-grow leading-relaxed text-slate-500 group-hover:text-white group-hover:font-medium text-sm transition-all duration-500 z-10">
                    {service.description}
                  </p>

                  {/* Action Button */}
                  <button className="relative w-full py-2.5 rounded-[5px] font-semibold bg-transparent group-hover:bg-white border border-[#2e88d1] group-hover:border-white text-[#2e88d1] transition-colors duration-500 z-10">
                    {service.price}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

export default Services;