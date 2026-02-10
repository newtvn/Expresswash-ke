import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Layers,
  Armchair,
  Blinds,
  RectangleHorizontal,
  Sofa,
  BedDouble,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/config/routes";

const services = [
  {
    icon: Layers,
    title: "Carpets",
    description:
      "Professional deep cleaning for all carpet types including Persian, shag, Berber, and wall-to-wall carpets. We use eco-friendly solutions that remove deep stains, allergens, and odors while preserving fabric integrity.",
    features: [
      "Hot water extraction",
      "Stain pre-treatment",
      "Deodorizing",
      "Fiber protection coating",
    ],
    priceFrom: 500,
    priceNote: "Prices vary by size and carpet type",
  },
  {
    icon: Armchair,
    title: "Chairs",
    description:
      "Expert fabric and leather chair cleaning. We revive office chairs, dining chairs, and accent chairs, removing dirt buildup, food stains, and everyday grime without damaging delicate upholstery.",
    features: [
      "Fabric & leather care",
      "Color restoration",
      "Anti-bacterial treatment",
      "Quick dry technology",
    ],
    priceFrom: 300,
    priceNote: "Per chair, bulk discounts available",
  },
  {
    icon: Blinds,
    title: "Curtains",
    description:
      "Gentle yet thorough curtain cleaning for all fabric types including silk, linen, polyester, and blackout curtains. We handle takedown and re-hanging at no extra cost within Kitengela.",
    features: [
      "Gentle wash cycles",
      "Takedown & rehang",
      "Wrinkle-free finish",
      "Color preservation",
    ],
    priceFrom: 200,
    priceNote: "Per pair, minimum 2 pairs",
  },
  {
    icon: RectangleHorizontal,
    title: "Rugs",
    description:
      "Specialized rug care and restoration for area rugs, oriental rugs, and decorative pieces. Our experts understand the unique requirements of different rug materials and weaving techniques.",
    features: [
      "Hand wash option",
      "Fringe cleaning",
      "Moth treatment",
      "Rug padding care",
    ],
    priceFrom: 400,
    priceNote: "Based on size in square feet",
  },
  {
    icon: Sofa,
    title: "Sofas",
    description:
      "Complete sofa and upholstery cleaning that brings new life to your living room. We handle everything from microfiber to leather, sectionals to loveseats, ensuring thorough cleaning of cushions and frames.",
    features: [
      "Deep cushion cleaning",
      "Frame sanitization",
      "Leather conditioning",
      "Scotchgard protection",
    ],
    priceFrom: 800,
    priceNote: "2-seater starting price, 3-seater from KES 1,200",
  },
  {
    icon: BedDouble,
    title: "Mattresses",
    description:
      "Deep sanitization and stain removal for all mattress types. Our process eliminates dust mites, bacteria, and allergens while removing stubborn stains for a healthier sleep environment.",
    features: [
      "UV sanitization",
      "Dust mite removal",
      "Stain extraction",
      "Hypoallergenic treatment",
    ],
    priceFrom: 600,
    priceNote: "Single mattress; Queen from KES 800",
  },
];

/**
 * Full Services Detail Page
 * Shows all 6 service types with descriptions, pricing, and CTAs.
 */
const ServicesDetail = () => {
  return (
    <main className="flex-1 pt-24 pb-16">
      <div className="container mx-auto">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Our Services
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Professional Cleaning for Every Fabric
          </h1>
          <p className="text-muted-foreground text-lg">
            From carpets to mattresses, we provide expert care for all your home
            textiles. Free pickup and delivery across all service zones.
          </p>
        </div>

        {/* Service Cards */}
        <div className="space-y-8 max-w-5xl mx-auto">
          {services.map((service, index) => (
            <Card
              key={service.title}
              className="bg-card border-border/50 overflow-hidden hover:shadow-apple-lg transition-all duration-300"
            >
              <CardContent className="p-0">
                <div
                  className={`flex flex-col md:flex-row ${
                    index % 2 === 1 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Icon / Visual Section */}
                  <div className="md:w-1/3 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center p-8 md:p-12">
                    <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                      <service.icon className="w-12 h-12 text-primary" />
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="md:w-2/3 p-6 md:p-8">
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-2xl font-bold text-foreground">
                        {service.title}
                      </h2>
                      <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        From KES {service.priceFrom.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-muted-foreground mb-4">
                      {service.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {service.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {service.priceNote}
                      </p>
                      <Link to={ROUTES.PRICING}>
                        <Button variant="hero" size="sm">
                          Get a Quote
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Not sure what you need? Let us help you figure it out.
          </p>
          <Link to={ROUTES.CONTACT}>
            <Button variant="heroOutline" size="lg">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
};

export default ServicesDetail;
