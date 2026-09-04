export const PricingArtworkStyles = () => (
  <style>{`
    @keyframes pricing-blob {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    }
    @keyframes pricing-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .pricing-ribbon-path {
      transition: stroke-dashoffset 100ms linear, opacity 80ms linear;
      will-change: stroke-dashoffset, opacity;
    }
    @media (prefers-reduced-motion: reduce) {
      .pricing-ribbon-path {
        opacity: 1 !important;
        stroke-dasharray: none !important;
        stroke-dashoffset: 0 !important;
        transition: none;
      }
    }
  `}</style>
);

export const PricingRibbonBackdrop = ({ progress }: { progress: number }) => {
  const leftProgress = Math.min(1, Math.max(0, progress / 0.92));
  const rightProgress = Math.min(1, Math.max(0, (progress - 0.045) / 0.88));

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 1440 1600"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pricing-ribbon-left" x1="0" y1="0" x2="650" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(var(--brand-blue))" stopOpacity="0.095" />
            <stop offset="0.46" stopColor="hsl(var(--brand-blue))" stopOpacity="0.055" />
            <stop offset="1" stopColor="hsl(var(--brand-blue))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pricing-ribbon-right" x1="1440" y1="0" x2="790" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(var(--brand-orange))" stopOpacity="0.085" />
            <stop offset="0.46" stopColor="hsl(var(--brand-orange))" stopOpacity="0.045" />
            <stop offset="1" stopColor="hsl(var(--brand-orange))" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M-210 132 C126 -52 520 52 500 310 C482 528 78 480 78 766 C78 992 468 910 500 1192 C526 1424 164 1540 -176 1394"
          stroke="url(#pricing-ribbon-left)"
          strokeWidth="72"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className="pricing-ribbon-path"
          style={{
            opacity: leftProgress <= 0.002 ? 0 : 1,
            strokeDasharray: "1 1",
            strokeDashoffset: 1 - leftProgress,
          }}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M1652 250 C1322 72 936 164 958 422 C978 642 1362 574 1362 858 C1362 1084 980 1020 940 1292 C910 1490 1210 1580 1614 1466"
          stroke="url(#pricing-ribbon-right)"
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className="pricing-ribbon-path"
          style={{
            opacity: rightProgress <= 0.002 ? 0 : 1,
            strokeDasharray: "1 1",
            strokeDashoffset: 1 - rightProgress,
          }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};
