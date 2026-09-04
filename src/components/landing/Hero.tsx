import carpetCleaningHero from "@/assets/carpet-cleaning-hero.webp";
import { HeroQuickBooking } from "@/components/landing/HeroQuickBooking";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 overflow-hidden bg-white">
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
          <g className="hero-lines" stroke="#3b6fd4" strokeWidth="1.3" opacity="0.08">
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

            {/* Entrance animations: heading drops in word-by-word, faint lines draw in, sub-text & badges fade */}
            <style>{`
              .hero-anim-word { display: inline-block; opacity: 0; animation: heroDrop 0.6s cubic-bezier(0.22, 1.2, 0.36, 1) forwards; }
              .hero-anim-fade { opacity: 0; animation: heroFade 0.7s ease-out forwards; }
              @keyframes heroDrop { 0% { opacity: 0; transform: translateY(-0.7em) scale(0.94); } 60% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
              @keyframes heroFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
              .hero-lines path { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: heroLineDraw 4s ease-out forwards; }
              .hero-lines path:nth-child(1) { animation-delay: 0.1s; }
              .hero-lines path:nth-child(2) { animation-delay: 0.2s; }
              .hero-lines path:nth-child(3) { animation-delay: 0.3s; }
              .hero-lines path:nth-child(4) { animation-delay: 0.4s; }
              .hero-lines path:nth-child(5) { animation-delay: 0.5s; }
              .hero-lines path:nth-child(6) { animation-delay: 0.6s; }
              .hero-lines path:nth-child(7) { animation-delay: 0.7s; }
              .hero-lines path:nth-child(8) { animation-delay: 0.8s; }
              .hero-lines path:nth-child(9) { animation-delay: 0.9s; }
              .hero-lines path:nth-child(10) { animation-delay: 1s; }
              @keyframes heroLineDraw { to { stroke-dashoffset: 0; } }
              @media (prefers-reduced-motion: reduce) {
                .hero-anim-word, .hero-anim-fade { animation: none !important; opacity: 1; transform: none; }
                .hero-lines path { animation: none; stroke-dashoffset: 0; }
              }
            `}</style>

            {/* HEADING — typed out */}
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6 max-w-2xl mx-auto lg:mx-0"
              aria-label="Cleaner Carpets. Healthier Home."
            >
              <span className="block" aria-hidden="true">
                {"​"}
                <span className="hero-anim-word" style={{ animationDelay: "0.1s" }}>Cleaner</span>{" "}
                <span className="hero-anim-word text-primary" style={{ animationDelay: "0.32s" }}>Carpets.</span>
              </span>
              <span className="block" aria-hidden="true">
                {"​"}
                <span className="hero-anim-word text-primary" style={{ animationDelay: "0.54s" }}>Healthier</span>{" "}
                <span className="hero-anim-word" style={{ animationDelay: "0.76s" }}>Home.</span>
              </span>
            </h1>

            <p
              className="hero-anim-fade text-lg md:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed"
              style={{ animationDelay: "1.25s" }}
            >
              Deep cleaning, stain removal, and odor elimination for carpets and upholstery. Safe for kids, pets, and your home.
            </p>

            {/* SERVICE AREA BADGES — local SEO signals, visible to users & crawlers */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start" aria-label="Areas we serve">
              {[
                { area: "Kitengela", note: "Same Day" },
                { area: "Syokimau", note: "Same Day" },
                { area: "Athi River", note: "Same Day" },
                { area: "Nairobi", note: "48 hrs" },
              ].map(({ area, note }, i) => (
                <span
                  key={area}
                  className="hero-anim-fade inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-slate-200 rounded-full text-sm text-slate-700 shadow-sm"
                  style={{ animationDelay: `${1.8 + i * 0.11}s` }}
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <strong>{area}</strong>
                  <span className="text-slate-400 text-xs">· {note}</span>
                </span>
              ))}
            </div>

            {/* Playful doodle arrow flowing from the service areas to the booking bar */}
            <div className="hidden lg:block pointer-events-none -mt-1 pl-5" aria-hidden="true">
              <style>{`
                .hero-arrow__path { opacity: 0; stroke-dasharray: 1; stroke-dashoffset: 1; animation: heroArrowDraw 2.7s cubic-bezier(0.4, 0, 0.2, 1) 2.7s forwards; }
                .hero-arrow__head { opacity: 0; stroke-dasharray: 1; stroke-dashoffset: 1; animation: heroArrowDraw 0.5s ease-out 5.25s forwards; }
                @keyframes heroArrowDraw { from { opacity: 1; } to { opacity: 1; stroke-dashoffset: 0; } }
                @media (prefers-reduced-motion: reduce) {
                  .hero-arrow__path, .hero-arrow__head { animation: none; opacity: 1; stroke-dashoffset: 0; }
                }
              `}</style>
              <svg viewBox="0 0 540 220" className="w-[30rem] xl:w-[34rem] text-[#F4743B]" fill="none">
                <path
                  className="hero-arrow__path"
                  pathLength="1"
                  d="M520 24 C 500 38, 490 78, 455 88 C 414 100, 382 38, 338 34 C 286 30, 252 126, 202 164 C 165 192, 150 92, 110 78 C 76 66, 48 116, 38 190"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="hero-arrow__head"
                  pathLength="1"
                  d="M18 157 L38 192 L74 173"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

          </div>

          <div className="hidden lg:block lg:col-span-5"></div>
        </div>
      </div>

      <div className="mt-8 lg:mt-5">
        <HeroQuickBooking />
      </div>
    </section>
  );
};

export default Hero;
