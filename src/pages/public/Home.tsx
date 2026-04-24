import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import Process from "@/components/landing/Process";
import PricingCalculator from "@/components/landing/PricingCalculator";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import { useSEO } from "@/hooks/useSEO";

/**
 * Public Home Page
 * Composes all landing page sections. No Header/Footer (PublicLayout handles that).
 */
const Home = () => {
  useSEO({
    title: "Carpet Cleaning Kitengela & Nairobi | Express Carpets Kenya",
    description: "Professional carpet cleaning, sofa washing & rug cleaning in Kitengela, Syokimau, Athi River & Nairobi. Free pickup & delivery. Book now!",
    keywords: "carpet cleaning near me, carpet cleaning Kitengela, carpet cleaning Syokimau, carpet cleaning Athi River, expresscarpets, expresswash, carpets wash, carpet cleaners, carpet cleaning nairobi, laundry wash nairobi, rags cleaning, rags washing, chair washing, curtains washing, sofa cleaning nairobi, sofa washing, upholstery cleaning kenya, mattress cleaning, carpet wash nairobi, sofa cleaning Kitengela, professional carpet cleaning kenya",
    canonical: "https://expresscarpets.co.ke/",
  });

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
