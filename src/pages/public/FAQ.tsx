import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES } from "@/config/routes";
import { HelpCircle } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PageBreadcrumb } from "@/components/shared";

const faqs = [
  {
    question: "How does Express Carpets & Upholstery work?",
    answer:
      "It is simple: schedule a pickup online or by phone, our driver collects your items, we clean them at our facility, and deliver them back fresh and clean. You can track your order in real-time using your tracking code.",
  },
  {
    question: "What areas do you serve?",
    answer:
      "We currently serve three zones: Kitengela, Athi River (including Syokimau & Mlolongo), and Greater Nairobi. Same-day service is available for Kitengela and Athi River, while Greater Nairobi orders take 48 hours.",
  },
  {
    question: "How much does cleaning cost?",
    answer:
      "Our pricing depends on the item type and size. Carpets start from KES 500, chairs from KES 300, curtains from KES 200 per pair, rugs from KES 400, sofas from KES 800, and mattresses from KES 600. Use our pricing calculator for an instant quote.",
  },
  {
    question: "How long does the cleaning process take?",
    answer:
      "Standard turnaround is 2-3 business days from pickup. Same-day service is available for Kitengela and Athi River zones at no extra charge for orders placed before 10 AM. Heavily soiled items may require additional time.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept M-Pesa, bank transfers, credit/debit cards, and cash on delivery. For corporate accounts, we offer monthly invoicing. All prices are inclusive of VAT.",
  },
  {
    question: "How can I track my order?",
    answer:
      "After pickup, you will receive a tracking code via SMS and email. Visit our Track Order page, enter your code, and view real-time updates through our 12-stage tracking pipeline -- from pickup to delivery.",
  },
  {
    question: "Is there a minimum order?",
    answer:
      "There is no minimum order requirement. However, we recommend combining items to get the best value, as pickup and delivery costs are included in the price regardless of order size.",
  },
  {
    question: "Do you offer pickup and delivery?",
    answer:
      "Yes, free pickup and delivery is included in all our prices. Our drivers will come to your location at the scheduled time. You can specify delivery instructions and preferred time windows.",
  },
  {
    question: "What if my items are damaged during cleaning?",
    answer:
      "All items are insured during the cleaning process. We conduct a thorough inspection before and after cleaning. In the rare event of damage, we will compensate you based on the assessed value. Please report any concerns within 24 hours of delivery.",
  },
  {
    question: "Can I cancel or reschedule my order?",
    answer:
      "You can cancel or reschedule your order at any time before pickup at no charge. Once items have been picked up, cancellation fees may apply. Contact our support team for assistance.",
  },
  {
    question: "Do you have a loyalty program?",
    answer:
      "Yes, our loyalty program rewards repeat customers. Earn points on every order, climb through Bronze, Silver, Gold, and Platinum tiers, and unlock exclusive discounts and perks. Sign up for a free account to start earning.",
  },
  {
    question: "How do referrals work?",
    answer:
      "Share your unique referral code with friends and family. When they place their first order, both of you receive KES 200 off your next order. There is no limit to how many people you can refer.",
  },
  {
    question: "Do you offer carpet cleaning near me in Syokimau, Athi River or Kitengela?",
    answer:
      "Yes! We are the leading carpet cleaning service near you in Syokimau, Athi River, Mlolongo, and Kitengela. We offer free pickup and delivery with same-day service available for all three zones when you book before 10 AM. Search 'carpet cleaning near me' and you will find us.",
  },
  {
    question: "Do you wash rugs and rags?",
    answer:
      "Yes, we specialize in rug washing and rags cleaning for all sizes and materials — from small decorative rags to large Persian and oriental rugs. We use hand wash or machine wash depending on the fabric type. Rags cleaning starts from KES 400 depending on size.",
  },
  {
    question: "Do you offer laundry wash services for homes in Nairobi?",
    answer:
      "Yes, Express Carpets & Upholstery (also known as ExpressWash) provides professional laundry wash services for household textiles. This includes carpets, sofas, chairs, curtains, rugs, rags, and mattresses. We serve Kitengela, Syokimau, Athi River, and Greater Nairobi.",
  },
  {
    question: "Can you clean sofas and do sofa washing at home?",
    answer:
      "We offer sofa cleaning and sofa washing with our free pickup and delivery service — meaning we come to your location in Kitengela, Syokimau, Athi River or Nairobi, collect your sofa cushions or the whole sofa (where applicable), clean them at our facility, and return them fresh. Sofa washing starts from KES 800.",
  },
  {
    question: "How do I find Express Carpets — is it the same as ExpressWash?",
    answer:
      "Yes! Express Carpets & Upholstery is also known as ExpressWash or Express Wash Kenya. We are a professional carpet and fabric cleaning company based in Kitengela, Kenya. You can find us at expresscarpets.co.ke or search for 'expresscarpets', 'expresswash', or 'carpet cleaning Kitengela' on Google.",
  },
  {
    question: "Do you do curtain washing and curtain cleaning services?",
    answer:
      "Yes, we offer professional curtain washing for all fabric types including silk, linen, polyester, and blackout curtains. We handle takedown and re-hanging at no extra cost within Kitengela. Curtain washing starts from KES 200 per pair.",
  },
];

/**
 * FAQ Page
 * Displays frequently asked questions using shadcn Accordion.
 */
const FAQ = () => {
  useSEO({
    title: "FAQ — Carpet Cleaning, Sofa Washing & Laundry Wash | Express Carpets Kenya",
    description: "Answers to your questions about carpet cleaning, sofa washing, rug cleaning, rags washing, curtain washing, chair washing & laundry wash in Kitengela, Syokimau, Athi River & Nairobi. Free pickup & delivery.",
    keywords: "carpet cleaning faq, sofa washing questions, rug cleaning nairobi, curtain washing kitengela, laundry wash syokimau, rags washing athi river, expresscarpets, expresswash",
    canonical: "https://expresscarpets.co.ke/faq",
  });

  return (
    <div className="flex-1 pt-24 pb-16">
      <div className="container mx-auto">
        <PageBreadcrumb items={[{ label: 'FAQ' }]} />
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            FAQ
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about our carpet cleaning service. Can
            not find what you are looking for? Contact us directly.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-5">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pl-8 pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Still have questions? We are here to help.
          </p>
          <Link to={ROUTES.CONTACT}>
            <Button variant="hero" size="lg">
              Contact Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
