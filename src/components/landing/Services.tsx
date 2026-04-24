import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Armchair,
  Layers,
  BedDouble,
  Blinds,
  Sofa,
  RectangleHorizontal,
  Phone,
  Mail,
  LogIn,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

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
   2. FOAM / BUBBLE TRANSITION SVG
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
      <rect y="90" width="1440" height="70" fill="currentColor" />
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
   3. WHATSAPP ICON SVG
   ─────────────────────────────────────────────────────────────────── */
const WaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
  </svg>
);

/* ───────────────────────────────────────────────────────────────────
   4. SERVICE ENQUIRY MODAL (shown when user is NOT signed in)
   ─────────────────────────────────────────────────────────────────── */
const ServiceModal = ({
  service,
  onClose,
}: {
  service: { title: string };
  onClose: () => void;
}) => {
  const label = service.title.replace(" Cleaning", "").replace(" Washing", "");
  const waMessage = `Hi,\nI'm interested in your services, may I get your rate card for ${service.title.toLowerCase()}?`;
  const waUrl = `https://wa.me/254746747481?text=${encodeURIComponent(waMessage)}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-1">{service.title}</h2>
        <p className="text-sm text-slate-500 mb-6">How would you like to enquire?</p>

        <div className="flex flex-col gap-4">
          {/* WhatsApp option */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
              <WaIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors">
                Chat on WhatsApp
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Ask about {label.toLowerCase()} pricing — no account needed
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <a
                  href="tel:+254746747481"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-green-700 transition-colors"
                >
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>Call: 0746 747 481</span>
                </a>
                <a
                  href="mailto:expresscleaning@goalfusion.co.ke?subject=Enquiry"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-green-700 transition-colors"
                >
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>expresscleaning@goalfusion.co.ke</span>
                </a>
              </div>
            </div>
          </a>

          {/* Sign in option */}
          <a
            href="/auth/signin"
            onClick={onClose}
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-[#007AF4] hover:bg-blue-50 transition-all group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-[#007AF4] transition-colors">
              <LogIn className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 group-hover:text-[#007AF4] transition-colors">
                Sign In / Create Account
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Book a pickup, track orders &amp; get exclusive offers
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────────
   5. SERVICES DATA
   ─────────────────────────────────────────────────────────────────── */
const services = [
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

/* ───────────────────────────────────────────────────────────────────
   6. MAIN SERVICES COMPONENT
   ─────────────────────────────────────────────────────────────────── */
const Services = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [activeService, setActiveService] = useState<typeof services[0] | null>(null);

  const handleServiceClick = (service: typeof services[0]) => {
    if (isAuthenticated) {
      navigate("/portal/request-pickup");
    } else {
      setActiveService(service);
    }
  };

  return (
    <>
      <FoamTransition />

      <section id="services" className="pt-12 pb-24 bg-[#f2f8fc]">
        <CustomStyles />

        <div className="container mx-auto max-w-7xl px-6 relative z-10">

          {/* Header */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-[#007AF4] uppercase tracking-wider">
                Our Services
              </span>
              <span className="block w-16 h-[2px] bg-[#007AF4]/40" />
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
                  role="button"
                  tabIndex={0}
                  onClick={() => handleServiceClick(service)}
                  onKeyDown={(e) => e.key === "Enter" && handleServiceClick(service)}
                  className="animated-card group bg-white p-8 rounded-[5px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col items-center text-center cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />
                  <span className="animated-card__span" aria-hidden />

                  {/* Blob & Icon */}
                  <div className="relative flex items-center justify-center w-24 h-24 mb-6 z-20 transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="absolute top-1 -right-2 w-4 h-4 bg-slate-200 group-hover:bg-white/50 rounded-full animate-subtle-float transition-colors duration-300" />
                    <div className="absolute bottom-2 -left-2 w-3 h-3 bg-slate-200 group-hover:bg-white/50 rounded-full animate-subtle-float-reverse transition-colors duration-300" style={{ animationDelay: '1.5s' }} />
                    <div className="absolute inset-2 bg-slate-100 group-hover:bg-white group-hover:shadow-lg animate-blob-shape transition-all duration-300" />
                    <Icon className="relative z-10 w-10 h-10 stroke-[1.5px] text-slate-800 group-hover:text-[#007AF4] transition-colors duration-300" />
                  </div>

                  {/* Text */}
                  <h3 className="text-xl font-bold mb-3 text-[#007AF4] group-hover:text-white transition-colors duration-500 z-10">
                    {service.title}
                  </h3>
                  <p className="mb-8 flex-grow leading-relaxed text-slate-500 group-hover:text-white group-hover:font-medium text-sm transition-all duration-500 z-10">
                    {service.description}
                  </p>

                  {/* Price Button */}
                  <button
                    className="relative w-full py-2.5 rounded-[5px] font-semibold bg-transparent group-hover:bg-white border border-[#007AF4] group-hover:border-white text-[#007AF4] transition-colors duration-500 z-10"
                    onClick={(e) => { e.stopPropagation(); handleServiceClick(service); }}
                  >
                    Enquire
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {activeService && (
        <ServiceModal service={activeService} onClose={() => setActiveService(null)} />
      )}
    </>
  );
};

export default Services;
