import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Grace Wanjiku",
    location: "Kitengela",
    rating: 5,
    text: "Express Carpets & Upholstery transformed my old Persian rug! ",
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

const stats = [
  { target: 10000, suffix: "+", label: "Orders Completed", decimals: 0 },
  { target: 4.9, suffix: "", label: "Average Rating", decimals: 1 },
  { target: 99, suffix: "%", label: "On-Time Delivery", decimals: 0 },
  { target: 5, suffix: "+", label: "Years Experience", decimals: 0 },
];

const testimonialLengths = testimonials.map(({ text, highlight, textAfter }) =>
  (text + highlight + textAfter).length,
);

const MotionStyles = () => (
  <style>{`
    @keyframes testimonial-caret-blink {
      0%, 46% { opacity: 1; }
      47%, 100% { opacity: 0; }
    }
    .testimonial-caret {
      display: inline-block;
      width: 1.5px;
      height: 1em;
      margin-left: 2px;
      vertical-align: -0.12em;
      background: hsl(var(--brand-blue));
      animation: testimonial-caret-blink 720ms steps(1, end) infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .testimonial-caret { display: none; }
    }
  `}</style>
);

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

function useTypedTestimonials(active: boolean) {
  const [counts, setCounts] = useState(() => testimonialLengths.map(() => 0));

  useEffect(() => {
    if (!active) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCounts(testimonialLengths);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const characterDuration = 19;
    const stagger = 220;

    const typeFrame = (now: number) => {
      const elapsed = now - startedAt;
      const nextCounts = testimonialLengths.map((length, index) =>
        Math.min(length, Math.max(0, Math.floor((elapsed - index * stagger) / characterDuration))),
      );

      setCounts(nextCounts);
      if (nextCounts.some((count, index) => count < testimonialLengths[index])) {
        frame = window.requestAnimationFrame(typeFrame);
      }
    };

    frame = window.requestAnimationFrame(typeFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  return counts;
}

function useCountUp(active: boolean) {
  const [values, setValues] = useState(() => stats.map(() => 0));

  useEffect(() => {
    if (!active) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValues(stats.map((stat) => stat.target));
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = 1250;

    const countFrame = (now: number) => {
      const elapsed = now - startedAt;
      const nextValues = stats.map((stat, index) => {
        const progress = Math.min(1, Math.max(0, (elapsed - index * 90) / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        return stat.target * eased;
      });

      setValues(nextValues);
      if (nextValues.some((value, index) => value < stats[index].target)) {
        frame = window.requestAnimationFrame(countFrame);
      }
    };

    frame = window.requestAnimationFrame(countFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  return values;
}

const TypedFeedback = ({
  testimonial,
  count,
}: {
  testimonial: (typeof testimonials)[number];
  count: number;
}) => {
  const { text, highlight, textAfter } = testimonial;
  const fullLength = text.length + highlight.length + textAfter.length;
  const visibleText = text.slice(0, count);
  const visibleHighlight = highlight.slice(0, Math.max(0, count - text.length));
  const visibleAfter = textAfter.slice(0, Math.max(0, count - text.length - highlight.length));
  const hasStarted = count > 0;
  const isComplete = count >= fullLength;

  return (
    <p
      className="relative z-10 text-slate-500 text-sm mb-6 leading-relaxed"
      aria-label={`“${text}${highlight}${textAfter}”`}
    >
      <span className="invisible" aria-hidden="true">
        &ldquo;{text}<span className="font-semibold">{highlight}</span>{textAfter}&rdquo;
      </span>
      <span className="absolute inset-0" aria-hidden="true">
        &ldquo;{visibleText}<span className="font-semibold text-brand-blue">{visibleHighlight}</span>{visibleAfter}
        {isComplete && "”"}
        {hasStarted && !isComplete && <span className="testimonial-caret" />}
      </span>
    </p>
  );
};

const Testimonials = () => {
  const { ref: cardsRef, visible: cardsVisible } = useRevealOnScroll(0.15);
  const { ref: statsRef, visible: statsVisible } = useRevealOnScroll(0.3);
  const typedCounts = useTypedTestimonials(cardsVisible);
  const countedValues = useCountUp(statsVisible);

  return (
    <section className="py-24 bg-slate-50">
      <MotionStyles />
      <div className="container mx-auto max-w-7xl px-6">

        {/* Header — centered, matching other sections */}
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-brand-orange/40" />
            <span className="text-sm font-semibold text-brand-orange uppercase tracking-wider">
              Testimonials
            </span>
            <span className="block w-16 h-[2px] bg-brand-orange/40" />
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

              <TypedFeedback testimonial={testimonial} count={typedCounts[index]} />

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
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center transition-all duration-1000 ease-out"
              style={{
                opacity: statsVisible ? 1 : 0,
                transform: statsVisible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <p
                className="text-3xl md:text-4xl font-bold text-brand-blue mb-1 tabular-nums"
                aria-label={`${stat.target.toLocaleString()}${stat.suffix}`}
              >
                {countedValues[index].toLocaleString(undefined, {
                  minimumFractionDigits: stat.decimals,
                  maximumFractionDigits: stat.decimals,
                })}{stat.suffix}
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
