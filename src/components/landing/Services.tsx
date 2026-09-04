import { useEffect, useRef, useState } from "react";
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
    @keyframes service-bounce-in {
      0% { opacity: 0; transform: translateY(34px) scale(.94); }
      58% { opacity: 1; transform: translateY(-10px) scale(1.012); }
      76% { transform: translateY(5px) scale(.996); }
      90% { transform: translateY(-2px) scale(1.002); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
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
    .service-card-reveal {
      opacity: 0;
    }
    .service-card-reveal.is-visible {
      animation: service-bounce-in 680ms cubic-bezier(.2,.82,.22,1) both;
    }
    .service-semi-ring path {
      transition: stroke-dashoffset 90ms linear, opacity 70ms linear;
      will-change: stroke-dashoffset, opacity;
    }
    @media (prefers-reduced-motion: reduce) {
      .service-semi-ring path {
        opacity: 1 !important;
        stroke-dasharray: none !important;
        stroke-dashoffset: 0 !important;
        transition: none;
      }
      .service-card-reveal,
      .service-card-reveal.is-visible { animation: none; opacity: 1; transform: none; }
    }
  `}</style>
);

const semiRingPattern = [
  { top: 10, radius: "clamp(72px, 6.5vw, 112px)" },
  { top: 10, radius: "clamp(46px, 4vw, 70px)" },
  { top: 16, radius: "clamp(58px, 5vw, 88px)" },
  { top: 22, radius: "clamp(72px, 6.5vw, 108px)" },
  { top: 28, radius: "clamp(76px, 6.5vw, 112px)" },
  { top: 28, radius: "clamp(48px, 4vw, 72px)" },
  { top: 35, radius: "clamp(60px, 5vw, 90px)" },
  { top: 42, radius: "clamp(74px, 6.5vw, 110px)" },
  { top: 49, radius: "clamp(72px, 6vw, 106px)" },
  { top: 49, radius: "clamp(46px, 4vw, 68px)" },
  { top: 57, radius: "clamp(58px, 5vw, 86px)" },
  { top: 65, radius: "clamp(72px, 6.5vw, 108px)" },
  { top: 73, radius: "clamp(74px, 6.5vw, 110px)" },
  { top: 73, radius: "clamp(46px, 4vw, 70px)" },
  { top: 79, radius: "clamp(58px, 5vw, 86px)" },
  { top: 84, radius: "clamp(44px, 4vw, 60px)" },
  { top: 88, radius: "clamp(36px, 3vw, 50px)" },
];

const ringColors = [
  "text-primary/50",
  "text-[#F4743B]/60",
  "text-slate-400/55",
  "text-slate-950/40",
];

const ringDrawSpans = [5, 3.5, 5, 5, 6, 3.5, 5.5, 5.5, 6, 3.5, 6, 6, 4.5, 3.5, 4.5, 3.5, 3];
const ringLeads = [0, 1.4, 0.4, 0, 0.8, 1.8, 0.2, 0, 1, 1.6, 0.4, 0, 0.8, 1.8, 0.2, 1, 1.5];

const RingTrack = ({ side, progress }: { side: "left" | "right"; progress: number }) => (
  <div
    className={`absolute inset-y-0 w-28 sm:w-40 ${side === "left" ? "left-0" : "right-0"}`}
  >
    {semiRingPattern.map((ring, index) => {
      const top = Math.min(ring.top + (side === "right" && index % 3 === 0 ? 2 : 0), 90);
      const sideLead = side === "right" ? (index % 4) * 0.35 : 0;
      const localProgress = Math.max(
        0,
        Math.min(1, (progress * 100 - top + ringLeads[index] + sideLead) / ringDrawSpans[index])
      );

      return (
        <svg
          key={`${side}-${ring.top}-${index}`}
          viewBox="0 0 102 202"
          fill="none"
          className={`service-semi-ring absolute ${ringColors[(index + (side === "right" ? 2 : 0)) % ringColors.length]}`}
          style={{
            top: `${top}%`,
            width: ring.radius,
            aspectRatio: "1 / 2",
            [side]: 0,
            transform: side === "right" ? "scaleX(-1)" : undefined,
          }}
        >
          <path
            pathLength="1"
            d="M1 1 A100 100 0 0 1 1 201"
            stroke="currentColor"
            strokeWidth="1.35"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            style={{
              opacity: localProgress <= 0.002 ? 0 : 1,
              strokeDasharray: "1 1",
              strokeDashoffset: 1 - localProgress,
            }}
          />
        </svg>
      );
    })}
  </div>
);

const EdgeRings = ({ progress }: { progress: number }) => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
    <RingTrack side="left" progress={progress} />
    <RingTrack side="right" progress={progress} />
  </div>
);

/* ───────────────────────────────────────────────────────────────────
   2. FOAM / BUBBLE TRANSITION SVG
   ─────────────────────────────────────────────────────────────────── */
const FoamTransition = () => (
  <div className="foam-transition-reveal relative w-full z-30 overflow-hidden" style={{ marginTop: -155, marginBottom: -1 }}>
    <style>{`
      @keyframes foam-reveal { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes foam-drift-a { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-7px) } }
      @keyframes foam-drift-b { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(6px) } }
      .foam-transition-reveal { opacity: 0; animation: foam-reveal 0.8s ease-out 2.4s forwards; }
      .foam-drift-a { animation: foam-drift-a 6s ease-in-out infinite; }
      .foam-drift-b { animation: foam-drift-b 8s ease-in-out infinite; }
      @media (min-width: 1024px) { .foam-transition-reveal { animation-delay: 5.75s; } }
      @media (prefers-reduced-motion: reduce){
        .foam-transition-reveal { animation: none; opacity: 1; transform: none; }
        .foam-drift-a,.foam-drift-b{ animation: none }
      }
    `}</style>
    <svg
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height: 185 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Back suds layer — deepest shade, sits highest for depth. */}
      <path fill="#e6f0fb" d="M0,34 C 380,134 560,180 720,184 C 880,180 1100,134 1440,34 L1440,240 L0,240 Z" />
      <g fill="#e6f0fb">
        <circle cx="60"   cy="56"  r="58" />
        <circle cx="210"  cy="107" r="58" />
        <circle cx="360"  cy="144" r="58" />
        <circle cx="520"  cy="170" r="58" />
        <circle cx="700"  cy="182" r="58" />
        <circle cx="880"  cy="174" r="58" />
        <circle cx="1050" cy="150" r="58" />
        <circle cx="1210" cy="112" r="58" />
        <circle cx="1380" cy="56"  r="58" />
      </g>

      {/* Middle suds layer — mid shade, staggered for organic overlap. */}
      <path fill="#ecf4fc" d="M0,42 C 380,142 560,188 720,192 C 880,188 1100,142 1440,42 L1440,240 L0,240 Z" />
      <g fill="#ecf4fc">
        <circle cx="50"   cy="60"  r="52" />
        <circle cx="170"  cy="102" r="52" />
        <circle cx="290"  cy="136" r="52" />
        <circle cx="410"  cy="162" r="52" />
        <circle cx="530"  cy="179" r="52" />
        <circle cx="650"  cy="188" r="52" />
        <circle cx="770"  cy="189" r="52" />
        <circle cx="890"  cy="181" r="52" />
        <circle cx="1010" cy="165" r="52" />
        <circle cx="1130" cy="141" r="52" />
        <circle cx="1250" cy="108" r="52" />
        <circle cx="1370" cy="68"  r="52" />
        <circle cx="1440" cy="40"  r="52" />
      </g>

      {/* Front suds layer — dense, varied bumps so the whole valley crest reads as foam (no flat gaps). */}
      <path fill="#f2f8fc" d="M0,50 C 380,150 560,196 720,200 C 880,196 1100,150 1440,50 L1440,240 L0,240 Z" />
      <g fill="#f2f8fc">
        <circle cx="20"   cy="56"  r="52" />
        <circle cx="80"   cy="80"  r="44" />
        <circle cx="140"  cy="101" r="56" />
        <circle cx="200"  cy="120" r="46" />
        <circle cx="260"  cy="137" r="50" />
        <circle cx="320"  cy="152" r="42" />
        <circle cx="380"  cy="165" r="54" />
        <circle cx="440"  cy="175" r="46" />
        <circle cx="500"  cy="184" r="52" />
        <circle cx="560"  cy="191" r="44" />
        <circle cx="620"  cy="195" r="56" />
        <circle cx="680"  cy="198" r="46" />
        <circle cx="740"  cy="198" r="50" />
        <circle cx="800"  cy="196" r="44" />
        <circle cx="860"  cy="192" r="56" />
        <circle cx="920"  cy="187" r="46" />
        <circle cx="980"  cy="178" r="52" />
        <circle cx="1040" cy="168" r="42" />
        <circle cx="1100" cy="156" r="54" />
        <circle cx="1160" cy="142" r="46" />
        <circle cx="1220" cy="126" r="50" />
        <circle cx="1280" cy="107" r="56" />
        <circle cx="1340" cy="87"  r="44" />
        <circle cx="1400" cy="64"  r="52" />
        <circle cx="1440" cy="48"  r="46" />
      </g>

    </svg>

    {/* Free-floating bubbles — perfect circles (fixed px), drifting above the raised sides */}
    <div className="foam-drift-a absolute rounded-full bg-[#f2f8fc]" style={{ width: 22, height: 22, left: '4%',  top: '6%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#ecf4fc]" style={{ width: 12, height: 12, left: '8%',  top: '22%' }} />
    <div className="foam-drift-a absolute rounded-full bg-[#f2f8fc]" style={{ width: 9,  height: 9,  left: '12%', top: '12%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#ecf4fc]" style={{ width: 7,  height: 7,  left: '6%',  top: '34%' }} />
    <div className="foam-drift-a absolute rounded-full bg-[#f2f8fc]" style={{ width: 15, height: 15, left: '15%', top: '26%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#ecf4fc]" style={{ width: 6,  height: 6,  left: '10%', top: '4%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#f2f8fc]" style={{ width: 22, height: 22, left: '95%', top: '6%' }} />
    <div className="foam-drift-a absolute rounded-full bg-[#ecf4fc]" style={{ width: 12, height: 12, left: '91%', top: '22%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#f2f8fc]" style={{ width: 9,  height: 9,  left: '87%', top: '12%' }} />
    <div className="foam-drift-a absolute rounded-full bg-[#ecf4fc]" style={{ width: 7,  height: 7,  left: '93%', top: '34%' }} />
    <div className="foam-drift-b absolute rounded-full bg-[#f2f8fc]" style={{ width: 15, height: 15, left: '84%', top: '26%' }} />
    <div className="foam-drift-a absolute rounded-full bg-[#ecf4fc]" style={{ width: 6,  height: 6,  left: '89%', top: '4%' }} />
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
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-brand-blue hover:bg-blue-50 transition-all group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-brand-blue transition-colors">
              <LogIn className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 group-hover:text-brand-blue transition-colors">
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
  const [ringProgress, setRingProgress] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const updateRings = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;

      const bounds = section.getBoundingClientRect();
      const scrollFrontier = window.innerHeight * 0.75;
      const nextProgress = Math.max(0, Math.min(1, (scrollFrontier - bounds.top) / bounds.height));

      setRingProgress((current) =>
        Math.abs(current - nextProgress) < 0.001 ? current : nextProgress
      );
    };

    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateRings);
    };

    updateRings();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const cards = cardsRef.current;
    const firstCard = cards?.firstElementChild;
    if (!firstCard) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCardsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    observer.observe(firstCard);
    return () => observer.disconnect();
  }, []);

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

      <section ref={sectionRef} id="services" className="relative overflow-hidden bg-[#f2f8fc] pt-12 pb-24">
        <CustomStyles />
        <EdgeRings progress={ringProgress} />

        <div className="container mx-auto max-w-7xl px-6 relative z-10">

          {/* Header — centered, matching other sections */}
          <div className="mb-16 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="block w-16 h-[2px] bg-brand-orange/40" />
              <span className="text-sm font-semibold text-brand-orange uppercase tracking-wider">
                Our Services
              </span>
              <span className="block w-16 h-[2px] bg-brand-orange/40" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              What We Clean
            </h2>
          </div>

          {/* 3x2 Services Grid */}
          <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              const isTopRow = index < 3;
              const sequenceIndex = isTopRow ? 2 - index : index - 3;
              const delay = isTopRow ? sequenceIndex * 180 : 720 + sequenceIndex * 180;

              return (
                <div
                  key={service.title}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleServiceClick(service)}
                  onKeyDown={(e) => e.key === "Enter" && handleServiceClick(service)}
                  className={`service-card-reveal animated-card group bg-white p-8 rounded-[5px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col items-center text-center cursor-pointer ${
                    cardsVisible ? "is-visible" : ""
                  }`}
                  style={{ animationDelay: `${delay}ms` }}
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
                    <Icon className="relative z-10 w-10 h-10 stroke-[1.5px] text-slate-800 group-hover:text-brand-blue transition-colors duration-300" />
                  </div>

                  {/* Text */}
                  <h3 className="text-xl font-bold mb-3 text-brand-blue group-hover:text-white transition-colors duration-500 z-10">
                    {service.title}
                  </h3>
                  <p className="mb-8 flex-grow leading-relaxed text-slate-500 group-hover:text-white group-hover:font-medium text-sm transition-all duration-500 z-10">
                    {service.description}
                  </p>

                  {/* Price Button */}
                  <button
                    className="relative w-full py-2.5 rounded-[5px] font-semibold bg-transparent group-hover:bg-white border border-brand-blue group-hover:border-white text-brand-blue transition-colors duration-500 z-10"
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
