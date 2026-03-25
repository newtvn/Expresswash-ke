interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  textColor?: string;
}

const LogoIcon = ({ px }: { px: number }) => (
  <svg width={px} height={px} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Blue circle */}
    <circle cx="50" cy="50" r="50" fill="#1565C0" />

    {/* Swirl arcs connecting the 4 sparkles */}
    {/* Top arc: TL → TR */}
    <path d="M34,36 Q50,22 66,36" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>
    {/* Right arc: TR → BR */}
    <path d="M66,36 Q80,50 66,64" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>
    {/* Bottom arc: BR → BL */}
    <path d="M66,64 Q50,78 34,64" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>
    {/* Left arc: BL → TL */}
    <path d="M34,64 Q20,50 34,36" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>

    {/* 4-pointed sparkle: top-left (34, 36) */}
    <path d="M34,25 C35.8,31 35.8,31 42,33 C35.8,35 35.8,35 34,41 C32.2,35 32.2,35 26,33 C32.2,31 32.2,31 34,25Z" fill="white"/>
    {/* 4-pointed sparkle: top-right (66, 36) */}
    <path d="M66,25 C67.8,31 67.8,31 74,33 C67.8,35 67.8,35 66,41 C64.2,35 64.2,35 58,33 C64.2,31 64.2,31 66,25Z" fill="white"/>
    {/* 4-pointed sparkle: bottom-left (34, 64) */}
    <path d="M34,59 C35.8,65 35.8,65 42,67 C35.8,69 35.8,69 34,75 C32.2,69 32.2,69 26,67 C32.2,65 32.2,65 34,59Z" fill="white"/>
    {/* 4-pointed sparkle: bottom-right (66, 64) */}
    <path d="M66,59 C67.8,65 67.8,65 74,67 C67.8,69 67.8,69 66,75 C64.2,69 64.2,69 58,67 C64.2,65 64.2,65 66,59Z" fill="white"/>
  </svg>
);

const Logo = ({ size = 'md', showText = true, className = '', textColor = '#1B2B6B' }: LogoProps) => {
  const config = {
    sm: { px: 32, titleClass: 'text-lg', subClass: 'text-[9px]' },
    md: { px: 40, titleClass: 'text-xl', subClass: 'text-[10px]' },
    lg: { px: 52, titleClass: 'text-3xl', subClass: 'text-xs' },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon px={config.px} />
      {showText && (
        <div className="flex flex-col leading-none gap-0.5">
          <span
            className={`font-extrabold tracking-tight leading-none ${config.titleClass}`}
            style={{ color: textColor }}
          >
            Express
          </span>
          <span
            className={`font-medium leading-none ${config.subClass}`}
            style={{ color: textColor }}
          >
            Carpet &amp; Upholstery Cleaning
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
