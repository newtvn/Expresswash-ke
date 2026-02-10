import PricingCalculator from "@/components/landing/PricingCalculator";

/**
 * Standalone Pricing Page
 * Wraps the existing PricingCalculator with a page header section.
 */
const PricingPage = () => {
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
