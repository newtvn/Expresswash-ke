import { Link } from "react-router-dom";
import { Sparkles, MapPin, Phone, Mail, ShieldCheck } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 text-slate-700 pt-6 pb-8">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#2e88d1] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Express<span className="text-[#2e88d1]">Wash</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Professional carpet and fabric cleaning services.
              We pick up, clean, and deliver with care.
            </p>
            <div className="space-y-1">
              <a href="tel:+254700000000" className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#2e88d1] hover:translate-x-1 transition-all duration-200 py-1.5">
                <Phone className="w-4 h-4 shrink-0" />
                +254 700 000 000
              </a>
              <a href="mailto:hello@expresswash.co.ke" className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#2e88d1] hover:translate-x-1 transition-all duration-200 py-1.5">
                <Mail className="w-4 h-4 shrink-0" />
                hello@expresswash.co.ke
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Services</h4>
            <ul className="space-y-0.5">
              {["Carpets", "Sofas", "Curtains", "Rugs", "Mattresses", "Chairs"].map((item) => (
                <li key={item}>
                  <a href="#services" className="inline-block text-sm text-slate-500 hover:text-[#2e88d1] hover:translate-x-1 transition-all duration-200 py-1.5">
                    {item} Cleaning
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
            <ul className="space-y-0.5">
              {[
                { name: "About Us", href: "#" },
                { name: "How It Works", href: "#process" },
                { name: "Pricing", href: "#pricing" },
                { name: "Track Order", href: "/track" },
                { name: "FAQ", href: "#" },
                { name: "Contact", href: "#" },
              ].map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="inline-block text-sm text-slate-500 hover:text-[#2e88d1] hover:translate-x-1 transition-all duration-200 py-1.5">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Service Areas */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Service Areas</h4>
            <ul className="space-y-3">
              {[
                { name: "Kitengela", delivery: "Same Day" },
                { name: "Athi River", delivery: "Same Day" },
                { name: "Greater Nairobi", delivery: "48 Hours" },
              ].map((zone) => (
                <li key={zone.name} className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#2e88d1] mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-700">{zone.name}</p>
                    <p className="text-xs text-slate-400">{zone.delivery} Delivery</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom — copyright + trust badges */}
        <div className="border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <p className="text-sm text-slate-400">
              &copy; {currentYear} ExpressWash. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link to="/privacy" className="text-sm text-slate-400 hover:text-[#2e88d1] transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-slate-400 hover:text-[#2e88d1] transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium">100% Satisfaction Guarantee</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 tracking-wide">M-PESA</span>
              <span className="text-xs font-semibold text-slate-400 tracking-wide">VISA</span>
              <span className="text-xs font-semibold text-slate-400 tracking-wide">CASH</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
