import { Phone, CalendarCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatedButton } from "@/components/ui/animated-button";

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
  `}</style>
);

const CTA = () => {
  return (
    <section id="contact" className="relative z-20 bg-slate-50 px-6 pb-0 pt-8">
      <BubbleStyles />
      <div className="container mx-auto max-w-7xl">
        <div className="relative bg-[#007AF4] rounded-t-2xl px-8 py-14 md:px-16 md:py-16 overflow-hidden text-center">

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
                asChild
              >
                <Link to="/portal/request-pickup">
                  <CalendarCheck className="w-5 h-5 mr-1" />
                  Schedule Pickup
                </Link>
              </AnimatedButton>

              <AnimatedButton
                color="#fff"
                hoverColor="#007AF4"
                fillColor="#ffffff"
                bordered={true}
                className="text-base py-4"
                asChild
              >
                <a href="tel:+254700000000">
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
        <div className="relative w-full overflow-hidden" style={{ marginTop: -1 }}>
          <svg
            viewBox="0 -60 1440 220"
            preserveAspectRatio="none"
            className="block w-full"
            style={{ height: 160 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Blue base connecting to card */}
            <rect y="-60" width="1440" height="150" fill="#007AF4" />

            {/* Main cloud humps in background color */}
            <circle cx="0"    cy="100" r="40"  fill="#f8fafc" />
            <circle cx="90"   cy="95"  r="50"  fill="#f8fafc" />
            <circle cx="210"  cy="80"  r="75"  fill="#f8fafc" />
            <circle cx="340"  cy="90"  r="55"  fill="#f8fafc" />
            <circle cx="500"  cy="55"  r="100" fill="#f8fafc" />
            <circle cx="660"  cy="85"  r="60"  fill="#f8fafc" />
            <circle cx="780"  cy="95"  r="45"  fill="#f8fafc" />
            <circle cx="920"  cy="65"  r="85"  fill="#f8fafc" />
            <circle cx="1080" cy="90"  r="55"  fill="#f8fafc" />
            <circle cx="1250" cy="50"  r="105" fill="#f8fafc" />
            <circle cx="1400" cy="85"  r="60"  fill="#f8fafc" />
            <circle cx="1440" cy="100" r="40"  fill="#f8fafc" />

            {/* Gap fillers along the base */}
            <circle cx="45"   cy="100" r="35" fill="#f8fafc" />
            <circle cx="140"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="280"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="420"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="580"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="620"  cy="100" r="35" fill="#f8fafc" />
            <circle cx="720"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="850"  cy="95"  r="40" fill="#f8fafc" />
            <circle cx="1000" cy="95"  r="40" fill="#f8fafc" />
            <circle cx="1160" cy="95"  r="40" fill="#f8fafc" />
            <circle cx="1200" cy="100" r="35" fill="#f8fafc" />
            <circle cx="1340" cy="95"  r="40" fill="#f8fafc" />
            <circle cx="1440" cy="100" r="35" fill="#f8fafc" />

            {/* Solid fill below humps */}
            <rect y="90" width="1440" height="130" fill="#f8fafc" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default CTA;
