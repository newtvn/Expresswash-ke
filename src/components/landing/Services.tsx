import { Card, CardContent } from "@/components/ui/card";
import { 
  Armchair, 
  Layers, 
  BedDouble, 
  Blinds,
  Sofa,
  RectangleHorizontal
} from "lucide-react";

const services = [
  {
    icon: Layers,
    title: "Carpets",
    description: "Deep cleaning for all carpet types and sizes",
    price: "From KES 500",
  },
  {
    icon: Armchair,
    title: "Chairs",
    description: "Fabric and leather chair cleaning",
    price: "From KES 300",
  },
  {
    icon: Blinds,
    title: "Curtains",
    description: "Gentle cleaning for all fabric types",
    price: "From KES 200",
  },
  {
    icon: RectangleHorizontal,
    title: "Rugs",
    description: "Specialized rug care and restoration",
    price: "From KES 400",
  },
  {
    icon: Sofa,
    title: "Sofas",
    description: "Complete sofa and upholstery cleaning",
    price: "From KES 800",
  },
  {
    icon: BedDouble,
    title: "Mattresses",
    description: "Deep sanitization and stain removal",
    price: "From KES 600",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-24 bg-secondary/30">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Our Services</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            What We Clean
          </h2>
          <p className="text-muted-foreground text-lg">
            Professional cleaning for all your home textiles. We handle each item with care and expertise.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card 
              key={service.title} 
              className="group bg-card border-border/50 hover:border-primary/20 hover:shadow-apple-lg transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                    <service.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {service.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {service.description}
                    </p>
                    <span className="text-sm font-medium text-primary">
                      {service.price}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
