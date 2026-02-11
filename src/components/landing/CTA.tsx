import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone } from "lucide-react";
import { PlaceOrderDialog } from "@/components/customer/PlaceOrderDialog";

const CTA = () => {
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-95" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

      <div className="container mx-auto relative z-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4 sm:mb-6">
            Ready for Fresh, Clean Fabrics?
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 mb-6 sm:mb-8 max-w-xl mx-auto">
            Schedule your first pickup today and experience the ExpressWash difference.
            Free pickup, expert cleaning, timely delivery.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button
              size="xl"
              className="bg-background text-foreground hover:bg-background/90 shadow-apple-xl"
              onClick={() => setOrderOpen(true)}
            >
              Schedule Pickup
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="border-2 border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
              onClick={() => window.open('tel:+254700000000')}
            >
              <Phone className="w-5 h-5" />
              Call Us Now
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-primary-foreground/60 mt-6 sm:mt-8">
            Available Mon-Sat, 7AM - 7PM &bull; Free cancellation up to 2 hours before pickup
          </p>
        </div>
      </div>

      <PlaceOrderDialog open={orderOpen} onOpenChange={setOrderOpen} />
    </section>
  );
};

export default CTA;
