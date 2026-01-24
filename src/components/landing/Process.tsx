import { Phone, Truck, Sparkles, PackageCheck } from "lucide-react";

const steps = [
  {
    icon: Phone,
    step: "01",
    title: "Book Online",
    description: "Schedule a convenient pickup time through our website or call us directly.",
  },
  {
    icon: Truck,
    step: "02",
    title: "We Pick Up",
    description: "Our driver arrives at your doorstep to collect your items at the scheduled time.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Expert Cleaning",
    description: "Your items go through our 12-stage professional cleaning process.",
  },
  {
    icon: PackageCheck,
    step: "04",
    title: "We Deliver",
    description: "Fresh, clean items delivered back to you, ready to use.",
  },
];

const Process = () => {
  return (
    <section id="process" className="py-24 bg-background">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Simple 4-Step Process
          </h2>
          <p className="text-muted-foreground text-lg">
            We've made professional cleaning effortless. Just book, and we handle the rest.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div 
                key={step.step} 
                className="relative text-center group"
              >
                {/* Step number */}
                <div className="relative z-10 mx-auto mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-secondary group-hover:bg-primary transition-colors duration-300 flex items-center justify-center mx-auto shadow-apple-md group-hover:shadow-glow">
                    <step.icon className="w-8 h-8 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-apple-sm">
                    {step.step}
                  </span>
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {step.description}
                </p>

                {/* Arrow for larger screens */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 -right-4 text-border">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary/30">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Process;
