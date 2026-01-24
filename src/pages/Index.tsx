import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import Process from "@/components/landing/Process";
import PricingCalculator from "@/components/landing/PricingCalculator";
import Testimonials from "@/components/landing/Testimonials";
import CTA from "@/components/landing/CTA";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Services />
        <Process />
        <PricingCalculator />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
