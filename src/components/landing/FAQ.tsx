import { useEffect, useRef, useState } from "react";
import askImg from "@/assets/ask.webp";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does the pickup and delivery work?",
    answer:
      "It\u2019s completely hassle-free! Once you schedule a pickup, our team will come right to your door\u2014whether you\u2019re in an apartment or an estate. We\u2019ll tag your items, take them to our cleaning facility, and return them fresh and neatly packaged within 48 to 72 hours.",
  },
  {
    question: "What if it\u2019s the rainy season? Will my carpets still dry?",
    answer:
      "Absolutely. Unlike traditional dhobis or car washes that rely on the sun, we use industrial extractors and climate-controlled drying rooms. Rain or shine, your carpets and sofas are returned 100% dry and free of that damp \u201cwet dog\u201d smell.",
  },
  {
    question: "How do I pay for the service?",
    answer:
      "We believe in transparency and trust. You only pay once your items are delivered back to you clean and fresh. We accept payments securely via our M-Pesa Till Number. No hidden fees, ever.",
  },
  {
    question: "Can you remove tough stains like tea, wine, or pet accidents?",
    answer:
      "Yes! We assess every item before cleaning and treat spots with specialized, fabric-safe stain removers. While some set-in stains permanently alter the fabric dye, our deep-extraction process removes 95% of common household stains and completely neutralizes odors.",
  },
  {
    question: "Do I need to be home for the pickup?",
    answer:
      "You or a trusted representative (like your house manager or a family member) just needs to be there to hand over the items. We\u2019ll give you a call beforehand to confirm we are on the way to your location.",
  },
];

const BubbleStyles = () => (
  <style>{`
    @keyframes faq-bubble-1 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      20% { transform: translate(8px, -6px); border-radius: 45% 55% 50% 50%; }
      40% { transform: translate(-4px, -10px); border-radius: 55% 45% 42% 58%; }
      60% { transform: translate(6px, -3px); border-radius: 48% 52% 56% 44%; }
      80% { transform: translate(-2px, -7px); border-radius: 52% 48% 45% 55%; }
    }
    @keyframes faq-bubble-2 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      15% { transform: translate(-6px, -8px); border-radius: 54% 46% 48% 52%; }
      35% { transform: translate(5px, -4px); border-radius: 42% 58% 55% 45%; }
      55% { transform: translate(-3px, -10px); border-radius: 50% 50% 44% 56%; }
      75% { transform: translate(7px, -2px); border-radius: 46% 54% 52% 48%; }
    }
    @keyframes faq-bubble-3 {
      0%, 100% { transform: translate(0, 0); border-radius: 50%; }
      25% { transform: translate(10px, -5px); border-radius: 44% 56% 52% 48%; }
      50% { transform: translate(-7px, -8px); border-radius: 56% 44% 46% 54%; }
      75% { transform: translate(4px, -12px); border-radius: 48% 52% 58% 42%; }
    }
    .faq-bubble-1 { animation: faq-bubble-1 8s ease-in-out infinite; }
    .faq-bubble-2 { animation: faq-bubble-2 10s ease-in-out infinite; }
    .faq-bubble-3 { animation: faq-bubble-3 12s ease-in-out infinite; }
  `}</style>
);

function useRevealOnScroll(threshold = 0.15) {
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

const FAQ = () => {
  const { ref: sectionRef, visible: sectionVisible } = useRevealOnScroll(0.1);
  const accordionWrapRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Lock height after first render (with default item open) so the container never shifts
    const el = accordionWrapRef.current;
    if (!el || lockedHeight !== undefined) return;
    const frame = requestAnimationFrame(() => {
      setLockedHeight(el.scrollHeight);
    });
    return () => cancelAnimationFrame(frame);
  }, [lockedHeight]);

  return (
    <section id="faq" className="py-24 bg-slate-50">
      <BubbleStyles />
      <div className="container mx-auto max-w-7xl px-6">

        {/* Header */}
        <div className="mb-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-16 h-[2px] bg-[#007AF4]/40" />
            <span className="text-sm font-semibold text-[#007AF4] uppercase tracking-wider">
              FAQ
            </span>
            <span className="block w-16 h-[2px] bg-[#007AF4]/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Got Questions? We've Got Answers.
          </h2>
          <p className="text-slate-500 text-lg mt-3">
            Everything you need to know about our carpet cleaning service.
          </p>
        </div>

        {/* Split layout */}
        <div ref={sectionRef} className="grid lg:grid-cols-5 gap-12 items-start">

          {/* Left — Blue banner + illustration */}
          <div
            className="lg:col-span-2 lg:sticky lg:top-24 overflow-hidden rounded-2xl transition-all duration-1000 ease-out"
            style={{
              opacity: sectionVisible ? 1 : 0,
              transform: sectionVisible ? "translateY(0)" : "translateY(24px)",
            }}
          >
            {/* Blue banner with text */}
            <div className="relative bg-[#007AF4] px-8 pt-10 pb-8 text-center overflow-hidden">
              {/* Floating morphing bubbles */}
              <div className="faq-bubble-1 absolute top-4 left-6 w-16 h-16 bg-white/[0.07]" style={{ animationDelay: "0s" }} />
              <div className="faq-bubble-2 absolute top-8 right-6 w-12 h-12 bg-white/[0.06]" style={{ animationDelay: "1.5s" }} />
              <div className="faq-bubble-3 absolute bottom-4 left-10 w-10 h-10 bg-white/[0.08]" style={{ animationDelay: "3s" }} />
              <div className="faq-bubble-1 absolute bottom-6 right-8 w-14 h-14 bg-white/[0.05]" style={{ animationDelay: "2s" }} />

              <h3 className="relative z-10 text-2xl font-bold text-white mb-3">
                Ask Us Anything
              </h3>
              <p className="relative z-10 text-white/70 text-sm leading-relaxed max-w-xs mx-auto">
                Can't find what you're looking for? Reach out to us directly and we'll get back to you right away.
              </p>

              <a
                href="tel:+254700000000"
                className="relative z-10 inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full text-sm text-white font-medium transition-colors"
              >
                Call +254 700 000 000
              </a>
            </div>

            {/* Illustration */}
            <div className="bg-white">
              <img
                src={askImg}
                alt="Ask us anything illustration"
                loading="lazy"
                width={512}
                height={512}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Right — Accordion in height-locked container */}
          <div
            ref={accordionWrapRef}
            className="lg:col-span-3 overflow-hidden"
            style={lockedHeight ? { height: lockedHeight } : undefined}
          >
            <Accordion type="single" collapsible defaultValue="faq-0" className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="bg-white border border-slate-200/80 rounded-xl px-6 data-[state=open]:shadow-md transition-all duration-700 ease-out"
                  style={{
                    opacity: sectionVisible ? 1 : 0,
                    transform: sectionVisible ? "translateY(0)" : "translateY(20px)",
                    transitionDelay: `${index * 150}ms`,
                  }}
                >
                  <AccordionTrigger className="text-left text-slate-900 font-medium hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-500 leading-relaxed pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
