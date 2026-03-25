/**
 * Express Carpets & Upholstery Logo Component
 *
 * - Full logo (showText=true, default): uses /logo.png (official brand PNG)
 * - Icon only (showText=false): uses inline SVG icon for compact spaces (sidebars, etc.)
 *
 * Brand guidelines:
 *  - White/light background  → full-color logo (/logo.png)
 *  - Dark/colored background → use invert=true  (logo-white.svg fallback)
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  /** invert: use white logo variant (for dark/colored backgrounds) */
  invert?: boolean;
}

/** Brand circle icon – inline SVG used for icon-only (compact) contexts */
const LogoIcon = ({ px, invert = false }: { px: number; invert?: boolean }) => (
  <svg width={px} height={px} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill={invert ? 'white' : '#007AF4'} />
    <path d="M34,36 Q50,22 66,36" fill="none" stroke={invert ? '#007AF4' : 'white'} strokeWidth="4.5" strokeLinecap="round" opacity="0.9"/>
    <path d="M66,36 Q80,50 66,64" fill="none" stroke={invert ? '#007AF4' : 'white'} strokeWidth="4.5" strokeLinecap="round" opacity="0.9"/>
    <path d="M66,64 Q50,78 34,64" fill="none" stroke={invert ? '#007AF4' : 'white'} strokeWidth="4.5" strokeLinecap="round" opacity="0.9"/>
    <path d="M34,64 Q20,50 34,36" fill="none" stroke={invert ? '#007AF4' : 'white'} strokeWidth="4.5" strokeLinecap="round" opacity="0.9"/>
    <path d="M34,25 C35.8,31 35.8,31 42,33 C35.8,35 35.8,35 34,41 C32.2,35 32.2,35 26,33 C32.2,31 32.2,31 34,25Z" fill={invert ? '#007AF4' : 'white'}/>
    <path d="M66,25 C67.8,31 67.8,31 74,33 C67.8,35 67.8,35 66,41 C64.2,35 64.2,35 58,33 C64.2,31 64.2,31 66,25Z" fill={invert ? '#007AF4' : 'white'}/>
    <path d="M34,59 C35.8,65 35.8,65 42,67 C35.8,69 35.8,69 34,75 C32.2,69 32.2,69 26,67 C32.2,65 32.2,65 34,59Z" fill={invert ? '#007AF4' : 'white'}/>
    <path d="M66,59 C67.8,65 67.8,65 74,67 C67.8,69 67.8,69 66,75 C64.2,69 64.2,69 58,67 C64.2,65 64.2,65 66,59Z" fill={invert ? '#007AF4' : 'white'}/>
  </svg>
);

/** Height of the rendered logo image per size */
const heightMap = { sm: 32, md: 40, lg: 56 };

const Logo = ({ size = 'md', showText = true, className = '', invert = false }: LogoProps) => {
  const h = heightMap[size];

  if (!showText) {
    // Icon-only mode: inline SVG (works at any size, any background)
    return (
      <div className={className}>
        <LogoIcon px={h} invert={invert} />
      </div>
    );
  }

  // Full logo: use the official brand PNG
  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src="/logo.png"
        alt="Express Carpet & Upholstery Cleaning"
        style={{ height: h * 1.9, width: 'auto' }}
        className="object-contain"
      />
    </div>
  );
};

export default Logo;
export { LogoIcon };
