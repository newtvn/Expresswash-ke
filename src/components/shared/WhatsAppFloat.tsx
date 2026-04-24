import { MessageCircle } from "lucide-react";

const PHONE = "254746747481";
const MESSAGE = "hello i would like to enquire how much you charge for your cleaning services";
const WA_URL = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

const WhatsAppFloat = () => (
  <a
    href={WA_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp"
    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
  >
    <MessageCircle className="w-5 h-5 fill-white stroke-none flex-shrink-0" />
    <span className="pr-1">Get a Quote</span>
  </a>
);

export default WhatsAppFloat;
