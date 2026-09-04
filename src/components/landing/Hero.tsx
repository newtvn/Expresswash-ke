import carpetCleaningHero from "@/assets/carpet-cleaning-hero.webp";
import { HeroQuickBooking } from "@/components/landing/HeroQuickBooking";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-20 overflow-hidden bg-white">
      <img
        src={carpetCleaningHero}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute inset-0 z-0 h-full w-full object-contain object-[center_54%] lg:object-cover lg:object-center"
      />
      <div
        className="absolute inset-0 z-10 lg:hidden"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 42%, rgba(255,255,255,0.78) 50%, rgba(255,255,255,0.28) 62%, rgba(255,255,255,0.04) 78%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div
        className="absolute inset-0 z-10 hidden lg:block"
        style={{
          background:
            "radial-gradient(ellipse 52% 72% at 31% 37%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 38%, rgba(255,255,255,0.78) 60%, rgba(255,255,255,0.32) 78%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Faint hand-curved diagonal streaks — irregular spacing, fading toward the bottom & right */}
      <div
        className="absolute inset-0 z-[15] pointer-events-none"
        aria-hidden="true"
        style={{
          maskImage: 'radial-gradient(125% 115% at 0% 0%, #000 0%, #000 42%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(125% 115% at 0% 0%, #000 0%, #000 42%, transparent 82%)',
        }}
      >
        <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <g stroke="#3b6fd4" strokeWidth="1.3" opacity="0.08">
            <path d="M-60 160 Q 730 -172 1520 -460" />
            <path d="M-60 211 Q 730 -77 1520 -320" />
            <path d="M-60 269 Q 730 42 1520 -140" />
            <path d="M-60 320 Q 730 148 1520 20" />
            <path d="M-60 374 Q 730 260 1520 190" />
            <path d="M-60 428 Q 730 372 1520 360" />
            <path d="M-60 486 Q 730 491 1520 540" />
            <path d="M-60 546 Q 730 616 1520 730" />
            <path d="M-60 607 Q 730 741 1520 920" />
            <path d="M-60 671 Q 730 873 1520 1120" />
          </g>
        </svg>
      </div>

      <div className="container mx-auto max-w-7xl px-6 relative z-20 pointer-events-none">
        <div className="grid items-center gap-8 lg:grid-cols-12">

          <div className="lg:col-span-7 text-center lg:text-left pointer-events-auto lg:translate-y-4">

            {/* HEADING */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6 max-w-2xl mx-auto lg:mx-0">
              <span className="block">
                Cleaner <span className="text-primary">Carpets.</span>
              </span>
              <span className="block">
                <span className="text-primary">Healthier</span> Home.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed">
              Deep cleaning, stain removal, and odor elimination for carpets and upholstery. Safe for kids, pets, and your home.
            </p>

            {/* SERVICE AREA BADGES — local SEO signals, visible to users & crawlers */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start" aria-label="Areas we serve">
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

            {/* Playful doodle arrow guiding the eye down to the booking bar */}
            <div className="hidden lg:block pointer-events-none mt-10 pl-6" aria-hidden="true">
              <style>{`
                .hero-arrow__path { stroke-dasharray: 320; stroke-dashoffset: 320; animation: heroArrowDraw 1.6s ease-out 0.5s forwards; }
                .hero-arrow__head { opacity: 0; animation: heroArrowHead 0.3s ease-out 2s forwards; }
                @keyframes heroArrowDraw { to { stroke-dashoffset: 0; } }
                @keyframes heroArrowHead { to { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) {
                  .hero-arrow__path { animation: none; stroke-dashoffset: 0; }
                  .hero-arrow__head { animation: none; opacity: 1; }
                }
              `}</style>
              <svg viewBox="0 0 180 175" className="h-36 w-64 text-[#F4743B]" fill="none">
                <path
                  className="hero-arrow__path"
                  d="M46 14 C 120 6, 116 70, 72 82 C 38 94, 60 138, 100 154"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  className="hero-arrow__head"
                  d="M82 138 L100 156 L120 136"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

          </div>

          <div className="hidden lg:block lg:col-span-5"></div>
        </div>
      </div>

      <div className="mt-8 lg:mt-10">
        <HeroQuickBooking />
      </div>
    </section>
  );
};

export default Hero;
