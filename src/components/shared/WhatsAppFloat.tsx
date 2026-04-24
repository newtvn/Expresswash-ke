const PHONE = "254746747481";
const MESSAGE = "hello i would like to enquire how much you charge for your cleaning services";
const WA_URL = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

const WhatsAppIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-5 h-5 flex-shrink-0"
    fill="white"
    aria-hidden="true"
  >
    <path d="M24 4C13 4 4 13 4 24c0 3.6 1 7 2.7 9.9L4 44l10.4-2.7A19.9 19.9 0 0 0 24 44c11 0 20-9 20-20S35 4 24 4zm0 36c-3.1 0-6-.8-8.6-2.3l-.6-.4-6.2 1.6 1.7-6-.4-.6A15.9 15.9 0 0 1 8 24c0-8.8 7.2-16 16-16s16 7.2 16 16-7.2 16-16 16zm8.8-11.8c-.5-.2-2.8-1.4-3.2-1.5-.4-.2-.7-.2-1 .2-.3.5-1.1 1.5-1.4 1.8-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1l.7-.8.4-.7c.1-.2 0-.5-.1-.7l-1.4-3.4c-.4-.9-.7-.8-1-.8h-.8c-.3 0-.8.1-1.2.6-.4.5-1.6 1.6-1.6 3.8s1.7 4.4 1.9 4.7c.2.3 3.3 5.1 8 7.1 1.1.5 2 .8 2.7 1 1.1.3 2.2.3 3 .2.9-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2-.2-.2-.5-.3-1-.5z" />
  </svg>
);

const WhatsAppFloat = () => (
  <a
    href={WA_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp"
    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
  >
    <WhatsAppIcon />
    <span className="pr-1">Get a Quote</span>
  </a>
);

export default WhatsAppFloat;

