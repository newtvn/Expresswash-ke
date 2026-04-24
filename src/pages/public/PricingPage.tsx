import PricingCalculator from "@/components/landing/PricingCalculator";
import { useSEO } from "@/hooks/useSEO";

const PricingPage = () => {
  useSEO({
    title: "Pricing — Carpet Cleaning, Sofa Washing & Laundry Wash | Express Carpets Kenya",
    description: "Transparent pricing for carpet cleaning, sofa washing, rug & rags cleaning, curtain washing, chair washing & mattress sanitization in Kitengela, Syokimau, Athi River & Nairobi. Get an instant quote online.",
    keywords: "carpet cleaning price nairobi, sofa washing cost kitengela, rug cleaning price, curtain washing charges, chair washing price, laundry wash rates kenya, expresscarpets pricing, expresswash cost",
    canonical: "https://expresscarpets.co.ke/pricing",
  });

  return (
    <main className="flex-1 pt-24 pb-16">
      <div className="container mx-auto">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Transparent Pricing
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Simple, Honest Pricing
          </h1>
          <p className="text-muted-foreground text-lg">
            No hidden fees. Select your items and delivery zone to get an
            instant, accurate quote. Prices include pickup and delivery.
          </p>
        </div>
      </div>

      {/* Reuse the pricing calculator component */}
      <PricingCalculator />
    </main>
  );
};

export default PricingPage;
