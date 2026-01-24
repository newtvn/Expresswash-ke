import { Link } from "react-router-dom";
import { Sparkles, MapPin, Phone, Mail } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-background">
                Express<span className="text-primary">Wash</span>
              </span>
            </Link>
            <p className="text-background/60 text-sm mb-6">
              Professional carpet and fabric cleaning services. 
              We pick up, clean, and deliver with care.
            </p>
            <div className="space-y-2">
              <a href="tel:+254700000000" className="flex items-center gap-2 text-sm text-background/60 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" />
                +254 700 000 000
              </a>
              <a href="mailto:hello@expresswash.co.ke" className="flex items-center gap-2 text-sm text-background/60 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                hello@expresswash.co.ke
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-background mb-4">Services</h4>
            <ul className="space-y-2">
              {["Carpets", "Sofas", "Curtains", "Rugs", "Mattresses", "Chairs"].map((item) => (
                <li key={item}>
                  <a href="#services" className="text-sm text-background/60 hover:text-primary transition-colors">
                    {item} Cleaning
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-background mb-4">Company</h4>
            <ul className="space-y-2">
              {[
                { name: "About Us", href: "#" },
                { name: "How It Works", href: "#process" },
                { name: "Pricing", href: "#pricing" },
                { name: "Track Order", href: "/track" },
                { name: "FAQ", href: "#" },
                { name: "Contact", href: "#" },
              ].map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="text-sm text-background/60 hover:text-primary transition-colors">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Service Areas */}
          <div>
            <h4 className="font-semibold text-background mb-4">Service Areas</h4>
            <ul className="space-y-3">
              {[
                { name: "Kitengela", delivery: "Same Day" },
                { name: "Athi River", delivery: "Same Day" },
                { name: "Greater Nairobi", delivery: "48 Hours" },
              ].map((zone) => (
                <li key={zone.name} className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-background">{zone.name}</p>
                    <p className="text-xs text-background/40">{zone.delivery} Delivery</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/40">
            © {currentYear} ExpressWash. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-background/40 hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-background/40 hover:text-primary transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
