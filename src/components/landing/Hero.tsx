import { AnimatedButton } from "@/components/ui/animated-button";
import { Star, LogIn, Phone, Mail, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const WaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-5 h-5" fill="currentColor" aria-hidden="true">
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
  </svg>
);

const PHONE = "254746747481";
const WA_MESSAGE = "Hi,\nI'm interested in your services, may I get your rate card?";
const WA_URL = `https://wa.me/${PHONE}?text=${encodeURIComponent(WA_MESSAGE)}`;

const PickupChoiceModal = ({ onClose }: { onClose: () => void }) => (
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

      <h2 className="text-xl font-bold text-slate-900 mb-1">Schedule a Pickup</h2>
      <p className="text-sm text-slate-500 mb-6">How would you like to proceed?</p>

      <div className="flex flex-col gap-4">
        {/* WhatsApp option */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all group"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
            <WaIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors">Chat on WhatsApp</p>
            <p className="text-sm text-slate-500 mt-0.5">Quick enquiry — no account needed</p>
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
        <Link
          to="/auth/signin"
          onClick={onClose}
          className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-primary hover:bg-orange-50 transition-all group"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-primary transition-colors">
            <LogIn className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">Sign In / Create Account</p>
            <p className="text-sm text-slate-500 mt-0.5">Track orders, earn loyalty rewards &amp; get exclusive offers</p>
          </div>
        </Link>
      </div>
    </div>
  </div>
);

/* ───────────────────────────────────────────────────────────────────
   1. FIBER CANVAS
   ─────────────────────────────────────────────────────────────────── */
function useFiberCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas!.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      ctx!.clearRect(0, 0, w, h);

      const count = Math.floor((w * h) / 3000);

      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const isDot = Math.random() > 0.6;

        const opacity = Math.random() * 0.4 + 0.3;
        ctx!.fillStyle = `rgba(40, 35, 30, ${opacity})`;
        ctx!.strokeStyle = `rgba(40, 35, 30, ${opacity})`;

        if (isDot) {
          const size = Math.random() * 1.2 + 0.4;
          ctx!.beginPath();
          ctx!.arc(x, y, size, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          const length = Math.random() * 8 + 3;
          const angle = Math.random() * Math.PI * 2;
          const thickness = Math.random() * 1.5 + 0.5;

          ctx!.lineWidth = thickness;
          ctx!.lineCap = "round";
          ctx!.beginPath();
          ctx!.moveTo(x, y);
          ctx!.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
          ctx!.stroke();
        }
      }
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [canvasRef]);
}

/* ───────────────────────────────────────────────────────────────────
   2. THE STRAIGHT-LINE VISUAL 
   ─────────────────────────────────────────────────────────────────── */
const UnifiedCleanVisual = () => (
  <svg
    viewBox="0 0 2400 1200"
    preserveAspectRatio="xMaxYMid slice"
    className="absolute inset-0 w-full h-full pointer-events-none z-10"
  >
    <defs>
      <filter id="carpetGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.04 0" in="noise" result="coloredNoise" />
        <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="composite" />
        <feBlend mode="multiply" in="composite" in2="SourceGraphic" />
      </filter>

      <filter id="wandShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="-15" dy="25" stdDeviation="20" floodColor="#000000" floodOpacity="0.2" />
      </filter>

      <linearGradient id="metalPipe" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>

      <linearGradient id="clearHead" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.6" />
      </linearGradient>
    </defs>

    <g>
      <polygon points="0,0 1100,0 1900,1200 0,1200" fill="#ffffff" />
      <polygon points="0,0 1100,0 1900,1200 0,1200" fill="#ffffff" filter="url(#carpetGrain)" />
    </g>

    <g>
      <polygon points="1767,550 1967,850 -28,2179 -228,1879" fill="#ffffff" />
      <polygon points="1767,550 1967,850 -28,2179 -228,1879" fill="#ffffff" filter="url(#carpetGrain)" />
    </g>

    <g>
      <polygon points="1967,850 2400,562 2400,1200 -28,2179" fill="#ffffff" />
      <polygon points="1967,850 2400,562 2400,1200 -28,2179" fill="#ffffff" filter="url(#carpetGrain)" />
    </g>

    <g filter="url(#wandShadow)">
      <line x1="2075" y1="562" x2="2740" y2="119" stroke="url(#metalPipe)" strokeWidth="45" strokeLinecap="round" />
      <line x1="2075" y1="552" x2="2740" y2="109" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.6" />

      <line x1="2300" y1="412" x2="2500" y2="278" stroke="#1e293b" strokeWidth="55" strokeLinecap="round" />

      <polygon points="1767,550 1967,850 2075,562" fill="#ffffff" />

      <polygon points="1830,640 1900,740 2075,562" fill="#453B32" opacity="0.15" />
      <line x1="1867" y1="700" x2="2075" y2="562" stroke="#453B32" strokeWidth="20" opacity="0.2" strokeLinecap="round" />

      <circle cx="1807" cy="610" r="8" fill="#06B6D4" />
      <circle cx="1847" cy="670" r="8" fill="#06B6D4" />
      <circle cx="1887" cy="730" r="8" fill="#06B6D4" />
      <circle cx="1927" cy="790" r="8" fill="#06B6D4" />

      <polygon
        points="1767,550 1967,850 2075,562"
        fill="url(#clearHead)"
        stroke="#94a3b8"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <rect x="2045" y="532" width="60" height="60" rx="8" fill="#334155" transform="rotate(-33.6, 2075, 562)" />

      <line x1="1767" y1="550" x2="1967" y2="850" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />
      <line x1="1767" y1="550" x2="1967" y2="850" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </g>
  </svg>
);

/* ───────────────────────────────────────────────────────────────────
   3. HERO COMPONENT
   ─────────────────────────────────────────────────────────────────── */
const Hero = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  useFiberCanvas(canvasRef);

  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.style.transform = `translateY(${window.scrollY * 0.4}px)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-24 pb-16 overflow-hidden bg-[#F1EFE9]">

      <div className="absolute inset-0 bg-[#F1EFE9] z-0" />

      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <UnifiedCleanVisual />

      <div ref={contentRef} className="container mx-auto max-w-7xl px-6 relative z-20 flex-grow flex flex-col justify-center h-full pointer-events-none">
        <div className="grid lg:grid-cols-12 gap-12 items-center h-full">

          <div className="lg:col-span-7 text-center lg:text-left pt-10 pointer-events-auto">

            {/* TAGLINE */}
            <p className="text-sm font-bold text-blue-900 tracking-wide mb-6">
              Professional Carpet &amp; Fabric Care
            </p>

            {/* HEADING */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6 max-w-2xl mx-auto lg:mx-0">
              Express Carpets &amp; <span className="text-primary">Upholstery.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed">
              <span className="font-semibold text-slate-800">Cleaner &amp; Faster:</span> We are a professional cleaning company, specializing in deep cleaning, restoration and maintenance of carpets and upholstery in Kitengela, Nairobi and its environs. At Express Carpets we use fully automated machines for dusting, cleaning and drying.
            </p>

            {/* SERVICE AREA BADGES — local SEO signals, visible to users & crawlers */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-8" aria-label="Areas we serve">
              {[
                { area: "Kitengela", note: "Same Day" },
                { area: "Syokimau", note: "Same Day" },
                { area: "Athi River", note: "Same Day" },
                { area: "Nairobi", note: "48 hrs" },
              ].map(({ area, note }) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-slate-200 rounded-full text-sm text-slate-700 shadow-sm"
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <strong>{area}</strong>
                  <span className="text-slate-400 text-xs">· {note}</span>
                </span>
              ))}
            </div>

            {/* BUTTON CONTRAST & HIERARCHY */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start mb-12">
              <AnimatedButton
                color="#fff"
                hoverColor="#fff"
                fillColor="#000000"
                bg="#F4743B"
                bordered={false}
                className="text-lg py-5"
                onClick={() => setPickupModalOpen(true)}
              >
                Schedule Pickup
              </AnimatedButton>
              <AnimatedButton
                color="#64748b"
                hoverColor="#fff"
                fillColor="#64748b"
                bordered={true}
                className="text-lg py-5"
                asChild
              >
                <a href="#pricing">Get a Quote</a>
              </AnimatedButton>
            </div>

            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 justify-center lg:justify-start">
              <div className="flex -space-x-3">
                <img className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://i.pravatar.cc/100?img=33" alt="Customer" />
                <img className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://i.pravatar.cc/100?img=47" alt="Customer" />
                <img className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://i.pravatar.cc/100?img=12" alt="Customer" />
                <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  +2k
                </div>
              </div>
              <div className="text-sm text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1 text-amber-500 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-slate-600 font-medium">
                  <span className="font-bold text-slate-900">10,000+</span> happy customers
                </p>
              </div>
            </div>

          </div>

          <div className="hidden lg:block lg:col-span-5"></div>
        </div>
      </div>

      {pickupModalOpen && <PickupChoiceModal onClose={() => setPickupModalOpen(false)} />}
    </section>
  );
};

export default Hero;