import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Grace Wanjiku",
    location: "Kitengela",
    rating: 5,
    text: "Express Carpets &amp; Upholstery transformed my old Persian rug! ",
    highlight: "It looks brand new.",
    textAfter: " The pickup and delivery was so convenient.",
    avatar: "GW",
  },
  {
    name: "James Odhiambo",
    location: "Athi River",
    rating: 5,
    text: "Professional service from start to finish. ",
    highlight: "My sofas have never been cleaner.",
    textAfter: " Highly recommend!",
    avatar: "JO",
  },
  {
    name: "Fatima Hassan",
    location: "Nairobi",
    rating: 5,
    text: "The tracking feature is amazing! ",
    highlight: "I could see exactly where my items were",
    textAfter: " throughout the process.",
    avatar: "FH",
  },
  {
    name: "Peter Kamau",
    location: "Kitengela",
    rating: 5,
    text: "",
    highlight: "Same-day service saved me",
    textAfter: " when I had unexpected guests. Quick, efficient, and affordable!",
    avatar: "PK",
  },
];

function useRevealOnScroll(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

const Testimonials = () => {
  const { ref: cardsRef, visible: cardsVisible } = useRevealOnScroll(0.15);
  const { ref: statsRef, visible: statsVisible } = useRevealOnScroll(0.3);

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto max-w-7xl px-6">

        {/* Header — centered, matching other sections */}
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-brand-blue/40" />
            <span className="text-sm font-semibold text-brand-blue uppercase tracking-wider">
              Testimonials
            </span>
            <span className="block w-16 h-[2px] bg-brand-blue/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            What Our Customers Say
          </h2>
          <p className="text-slate-500 text-lg mt-3">
            Join thousands of satisfied customers who trust us with their home textiles.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="relative overflow-hidden bg-white p-6 rounded-[5px] shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_10px_40px_-10px_rgba(46,136,209,0.3)] hover:-translate-y-2 transition-all duration-500"
              style={{
                opacity: cardsVisible ? 1 : 0,
                transform: cardsVisible ? "translateY(0)" : "translateY(24px)",
                transitionDelay: `${index * 150}ms`,
              }}
            >
              {/* Giant watermark quote */}
              <Quote className="absolute -bottom-3 right-4 w-24 h-24 text-brand-blue/[0.07] pointer-events-none rotate-180" />

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="relative z-10 text-slate-500 text-sm mb-6 leading-relaxed">
                &ldquo;{testimonial.text}<span className="font-semibold text-brand-blue">{testimonial.highlight}</span>{testimonial.textAfter}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-brand-blue">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div
          ref={statsRef}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
          {[
            { value: "10,000+", label: "Orders Completed" },
            { value: "4.9", label: "Average Rating" },
            { value: "99%", label: "On-Time Delivery" },
            { value: "5+", label: "Years Experience" },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="text-center transition-all duration-1000 ease-out"
              style={{
                opacity: statsVisible ? 1 : 0,
                transform: statsVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <p className="text-3xl md:text-4xl font-bold text-brand-blue mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
