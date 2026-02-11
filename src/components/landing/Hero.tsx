import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Clock, Shield } from "lucide-react";
import { PlaceOrderDialog } from "@/components/customer/PlaceOrderDialog";
import heroImage from "@/assets/hero-carpet.jpg";

const Hero = () => {
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 via-background to-background" />

      {/* Decorative elements */}
      <div className="absolute top-40 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto relative z-10 px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 animate-fade-in">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm font-medium text-primary">Premium Cleaning Service</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-slide-up">
              Professional Carpet &
              <span className="gradient-text"> Fabric Care</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              We pick up, clean, and deliver your carpets, sofas, and curtains with care.
              Trusted by thousands of homes across Kenya.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Button variant="hero" size="xl" onClick={() => setOrderOpen(true)}>
                Schedule Pickup
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="heroOutline" size="xl" onClick={() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>
                Get a Quote
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex flex-col items-center lg:items-start gap-1">
                <div className="flex items-center gap-1.5 sm:gap-2 text-primary">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-semibold">3 Zones</span>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground">Service Coverage</span>
              </div>
              <div className="flex flex-col items-center lg:items-start gap-1">
                <div className="flex items-center gap-1.5 sm:gap-2 text-primary">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Same Day</span>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground">Available</span>
              </div>
              <div className="flex flex-col items-center lg:items-start gap-1">
                <div className="flex items-center gap-1.5 sm:gap-2 text-primary">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Insured</span>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground">Protection</span>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in hidden sm:block" style={{ animationDelay: '0.2s' }}>
            <div className="relative rounded-3xl overflow-hidden shadow-apple-xl">
              <img
                src={heroImage}
                alt="Professional carpet cleaning service"
                className="w-full h-auto object-cover aspect-[4/3]"
              />
              {/* Overlay card */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 glass rounded-2xl p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-foreground">10,000+</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Happy Customers</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border" />
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-foreground">4.9 ★</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border" />
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-foreground">5+ Years</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Experience</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground rounded-2xl px-4 py-2 shadow-glow animate-float">
              <p className="text-xs font-semibold">Free Pickup</p>
            </div>
          </div>
        </div>
      </div>

      <PlaceOrderDialog open={orderOpen} onOpenChange={setOrderOpen} />
    </section>
  );
};

export default Hero;
