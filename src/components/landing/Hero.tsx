import { AnimatedButton } from "@/components/ui/animated-button";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";

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

            {/* UNIFIED TYPOGRAPHY HIERARCHY (Natural Wrap) */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-3 max-w-2xl mx-auto lg:mx-0">
              Expresscarpets &amp; <span className="text-primary">Upholstery.</span>
            </h1>
            <p className="text-xl md:text-2xl font-semibold text-slate-500 tracking-wide mb-6 max-w-2xl mx-auto lg:mx-0">
              Professional Carpet &amp; Fabric Care
            </p>

            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed">
              <span className="font-semibold text-slate-800">Cleaner &amp; Faster.</span> We pick up, deep clean, and deliver your carpets, sofas, curtains, rugs and mattresses with precision care. Trusted by thousands of homes across Kenya.
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
                asChild
              >
                <Link to="/portal/request-pickup">
                  Schedule Pickup
                </Link>
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
    </section>
  );
};

export default Hero;