import { useEffect, useRef, useState } from "react";
import { Phone, CalendarCheck, X, MessageCircle, LogIn } from "lucide-react";
import { AnimatedButton } from "@/components/ui/animated-button";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const PHONE = "254746747481";
const WA_MESSAGE = "Hi,\nI'm interested in your services, may I get your rate card?";
const WA_URL = `https://wa.me/${PHONE}?text=${encodeURIComponent(WA_MESSAGE)}`;

const mainFoamBubbles = [
  [0, 100, 40], [90, 95, 50], [210, 80, 75], [340, 90, 55],
  [500, 55, 100], [660, 85, 60], [780, 95, 45], [920, 65, 85],
  [1080, 90, 55], [1250, 50, 105], [1400, 85, 60], [1440, 100, 40],
];

const fillerFoamBubbles = [
  [45, 100, 35], [140, 95, 40], [280, 95, 40], [420, 95, 40],
  [580, 95, 40], [620, 100, 35], [720, 95, 40], [850, 95, 40],
  [1000, 95, 40], [1160, 95, 40], [1200, 100, 35], [1340, 95, 40],
  [1440, 100, 35],
];

const WaIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className={className} fill="currentColor" aria-hidden="true">
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
  </svg>
);

const PickupChoiceModal = ({ onClose }: { onClose: () => void }) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900">How would you like to proceed?</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Options */}
      <div className="p-6 grid gap-4">
        {/* WhatsApp / Contact */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 rounded-xl border-2 border-green-100 hover:border-green-400 hover:bg-green-50 transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 text-white group-hover:bg-green-600 transition-colors">
            <WaIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Chat on WhatsApp</p>
            <p className="text-sm text-slate-500 mb-2">Get a quote, ask questions or book a pickup.</p>
            <div className="flex flex-col gap-1">
              <a href="tel:+254746747481" onClick={e => e.stopPropagation()} className="text-sm text-brand-blue hover:underline flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> +254 746 747 481
              </a>
              <a href="mailto:expresscleaning@goalfusion.co.ke?subject=Enquiry" onClick={e => e.stopPropagation()} className="text-sm text-brand-blue hover:underline flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> expresscleaning@goalfusion.co.ke
              </a>
            </div>
          </div>
        </a>

        {/* Sign In */}
        <a
          href="/auth/signin"
          className="flex items-start gap-4 p-4 rounded-xl border-2 border-brand-blue/20 hover:border-brand-blue hover:bg-brand-blue/5 transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-full bg-brand-blue flex items-center justify-center flex-shrink-0 text-white group-hover:bg-brand-navy transition-colors">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Sign In to Your Account</p>
            <p className="text-sm text-slate-500">Track orders, get exclusive offers and manage pickups from your dashboard.</p>
          </div>
        </a>
      </div>
    </div>
  </div>
);

const BubbleStyles = () => (
  <style>{`
    @keyframes bubble-drift-1 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      20% { transform: translate(8px, -6px); border-radius: 45% 55% 50% 50%; }
      40% { transform: translate(-4px, -10px); border-radius: 55% 45% 42% 58%; }
      60% { transform: translate(6px, -3px); border-radius: 48% 52% 56% 44%; }
      80% { transform: translate(-2px, -7px); border-radius: 52% 48% 45% 55%; }
    }
    @keyframes bubble-drift-2 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      15% { transform: translate(-6px, -8px); border-radius: 54% 46% 48% 52%; }
      35% { transform: translate(5px, -4px); border-radius: 42% 58% 55% 45%; }
      55% { transform: translate(-3px, -10px); border-radius: 50% 50% 44% 56%; }
      75% { transform: translate(7px, -2px); border-radius: 46% 54% 52% 48%; }
    }
    @keyframes bubble-drift-3 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      25% { transform: translate(10px, -5px); border-radius: 44% 56% 52% 48%; }
      50% { transform: translate(-7px, -8px); border-radius: 56% 44% 46% 54%; }
      75% { transform: translate(4px, -12px); border-radius: 48% 52% 58% 42%; }
    }
    .bubble-1 { animation: bubble-drift-1 8s ease-in-out infinite; }
    .bubble-2 { animation: bubble-drift-2 10s ease-in-out infinite; }
    .bubble-3 { animation: bubble-drift-3 12s ease-in-out infinite; }
    @keyframes cta-foam-pop {
      0% { opacity: 0; transform: translateY(34px) scale(.56); }
      62% { opacity: 1; transform: translateY(-6px) scale(1.055); }
      82% { transform: translateY(3px) scale(.985); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .cta-foam-bubble {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center bottom;
    }
    .cta-foam-visible .cta-foam-bubble {
      animation: cta-foam-pop 620ms cubic-bezier(.2,.8,.2,1) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .bubble-1, .bubble-2, .bubble-3 { animation: none; }
      .cta-foam-bubble { opacity: 1; transform: none; }
      .cta-foam-visible .cta-foam-bubble { animation: none; }
    }
  `}</style>
);

const CTA = () => {
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [foamVisible, setFoamVisible] = useState(false);
  const foamRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    const foam = foamRef.current;
    if (!foam) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFoamVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(foam);
    return () => observer.disconnect();
  }, []);

  const handleSchedulePickup = () => {
    if (isAuthenticated) {
      navigate("/portal/request-pickup");
    } else {
      setPickupModalOpen(true);
    }
  };

  return (
    <section id="contact" className="relative z-20 bg-slate-50 px-6 pb-0 pt-8">
      <BubbleStyles />
      {pickupModalOpen && <PickupChoiceModal onClose={() => setPickupModalOpen(false)} />}

      <div className="container mx-auto max-w-7xl">
        <div className="relative bg-brand-blue rounded-t-2xl px-8 py-14 md:px-16 md:py-16 overflow-hidden text-center">

          {/* Floating foam bubbles */}
          <div className="bubble-1 absolute top-8 left-[6%] w-20 h-20 rounded-full bg-white/[0.06]" />
          <div className="bubble-2 absolute top-14 left-[22%] w-10 h-10 rounded-full bg-white/[0.05]" style={{ animationDelay: '1s' }} />
          <div className="bubble-3 absolute top-6 right-[18%] w-14 h-14 rounded-full bg-white/[0.05]" style={{ animationDelay: '2s' }} />
          <div className="bubble-1 absolute bottom-16 right-[8%] w-28 h-28 rounded-full bg-white/[0.04]" style={{ animationDelay: '3s' }} />
          <div className="bubble-2 absolute bottom-24 left-[12%] w-16 h-16 rounded-full bg-white/[0.05]" style={{ animationDelay: '0.5s' }} />
          <div className="bubble-3 absolute top-1/2 left-[45%] w-8 h-8 rounded-full bg-white/[0.04]" style={{ animationDelay: '4s' }} />
          <div className="bubble-1 absolute top-1/3 right-[35%] w-6 h-6 rounded-full bg-white/[0.06]" style={{ animationDelay: '2.5s' }} />
          <div className="bubble-2 absolute bottom-12 left-[55%] w-12 h-12 rounded-full bg-white/[0.05]" style={{ animationDelay: '1.5s' }} />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready for Fresh, Clean Fabrics?
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
              Schedule your first pickup today and experience the Express Carpets &amp; Upholstery difference.
              Free pickup, expert cleaning, timely delivery.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AnimatedButton
                color="#fff"
                hoverColor="#fff"
                fillColor="#000000"
                bg="#F4743B"
                bordered={false}
                className="text-base py-4"
                onClick={handleSchedulePickup}
              >
                <CalendarCheck className="w-5 h-5 mr-1" />
                Schedule Pickup
              </AnimatedButton>

              <AnimatedButton
                color="#fff"
                hoverColor="#007AF4"
                fillColor="#ffffff"
                bordered={true}
                className="text-base py-4"
                asChild
              >
                <a href="tel:+254746747481">
                  <Phone className="w-5 h-5 mr-1" />
                  Call Us Now
                </a>
              </AnimatedButton>
            </div>

            <p className="text-sm text-white/70 mt-8">
              Available Mon-Sat, 7AM - 7PM &bull; Free cancellation up to 2 hours before pickup
            </p>
          </div>
        </div>

        {/* Foam transition — sits outside the card, on the slate-50 background */}
        <div
          ref={foamRef}
          className={`relative w-full overflow-hidden ${foamVisible ? "cta-foam-visible" : ""}`}
          style={{ marginTop: -1 }}
        >
          <svg
            viewBox="0 -60 1440 220"
            preserveAspectRatio="none"
            className="block w-full text-brand-blue"
            style={{ height: 160 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Blue base connecting to card — same token as the card so there's no seam */}
            <rect y="-60" width="1440" height="150" fill="currentColor" />

            {/* Main cloud humps in background color */}
            {mainFoamBubbles.map(([cx, cy, radius], index) => (
              <circle
                key={`main-${cx}-${radius}`}
                className="cta-foam-bubble"
                cx={cx}
                cy={cy}
                r={radius}
                fill="#f8fafc"
                style={{ animationDelay: `${index * 48}ms` }}
              />
            ))}

            {/* Gap fillers along the base */}
            {fillerFoamBubbles.map(([cx, cy, radius], index) => (
              <circle
                key={`filler-${cx}-${radius}`}
                className="cta-foam-bubble"
                cx={cx}
                cy={cy}
                r={radius}
                fill="#f8fafc"
                style={{ animationDelay: `${90 + index * 42}ms` }}
              />
            ))}

            {/* Solid fill below humps */}
            <rect y="90" width="1440" height="130" fill="#f8fafc" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default CTA;
