import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import Process from "@/components/landing/Process";
import PricingCalculator from "@/components/landing/PricingCalculator";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";

/**
 * Public Home Page
 * Composes all landing page sections. No Header/Footer (PublicLayout handles that).
 */
const Home = () => {
  return (
    <div className="flex-1">
      <Hero />
      <Services />
      <Process />
      <PricingCalculator />
      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
};

export default Home;
