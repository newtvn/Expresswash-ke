export const ServiceMotionStyles = () => (
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
    .animate-blob-shape { animation: blob-shape 6s ease-in-out infinite; }
    .animate-subtle-float { animation: subtle-float 4s ease-in-out infinite; }
    .animate-subtle-float-reverse { animation: subtle-float-reverse 5s ease-in-out infinite; }
    .service-card-reveal { opacity: 0; }
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
  <div className={`absolute inset-y-0 w-28 sm:w-40 ${side === "left" ? "left-0" : "right-0"}`}>
    {semiRingPattern.map((ring, index) => {
      const top = Math.min(ring.top + (side === "right" && index % 3 === 0 ? 2 : 0), 90);
      const sideLead = side === "right" ? (index % 4) * 0.35 : 0;
      const localProgress = Math.max(
        0,
        Math.min(1, (progress * 100 - top + ringLeads[index] + sideLead) / ringDrawSpans[index]),
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

export const ServiceEdgeRings = ({ progress }: { progress: number }) => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
    <RingTrack side="left" progress={progress} />
    <RingTrack side="right" progress={progress} />
  </div>
);
