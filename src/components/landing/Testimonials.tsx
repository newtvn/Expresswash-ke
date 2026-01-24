import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Grace Wanjiku",
    location: "Kitengela",
    rating: 5,
    text: "ExpressWash transformed my old Persian rug! It looks brand new. The pickup and delivery was so convenient.",
    avatar: "GW",
  },
  {
    name: "James Odhiambo",
    location: "Athi River",
    rating: 5,
    text: "Professional service from start to finish. My sofas have never been cleaner. Highly recommend!",
    avatar: "JO",
  },
  {
    name: "Fatima Hassan",
    location: "Nairobi",
    rating: 5,
    text: "The tracking feature is amazing! I could see exactly where my items were throughout the process.",
    avatar: "FH",
  },
  {
    name: "Peter Kamau",
    location: "Kitengela",
    rating: 5,
    text: "Same-day service saved me when I had unexpected guests. Quick, efficient, and affordable!",
    avatar: "PK",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Testimonials</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-muted-foreground text-lg">
            Join thousands of satisfied customers who trust us with their home textiles.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={testimonial.name}
              className="bg-card border-border/50 hover:shadow-apple-lg transition-all duration-300"
            >
              <CardContent className="p-6">
                <Quote className="w-8 h-8 text-primary/20 mb-4" />
                
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>

                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {testimonial.avatar}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.location}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { value: "10,000+", label: "Orders Completed" },
            { value: "4.9", label: "Average Rating" },
            { value: "99%", label: "On-Time Delivery" },
            { value: "5+", label: "Years Experience" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold gradient-text mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
