import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TermsOfService = () => {
  return (
    <main className="flex-1 pt-24 pb-16">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/80">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Service Overview</h2>
            <p>
              ExpressWash provides professional carpet, rug, curtain, sofa, mattress, and upholstery cleaning services
              in the Kitengela, Athi River, Syokimau, and Greater Nairobi areas. By using our platform and services, you
              agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Orders and Pricing</h2>
            <p>
              Prices displayed on the homepage calculator are estimates based on standard item sizes. Final pricing in the
              booking portal is calculated based on actual item dimensions (per square inch) as measured by our team during
              pickup. Prices include a delivery fee based on your zone and VAT at 16%.
            </p>
            <p>
              You may cancel an order before items have been picked up at no charge. Once items are in our possession,
              cancellation fees may apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Pickup and Delivery</h2>
            <p>
              We operate Monday through Friday, excluding public holidays. Estimated delivery times vary by zone:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Kitengela / Athi River: Same day or next business day</li>
              <li>Syokimau: 1 business day</li>
              <li>Greater Nairobi: 2 business days (48 hours)</li>
            </ul>
            <p>
              Delivery times are estimates and may be affected by weather, traffic, or high demand. We will notify you of
              any significant delays.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Payment</h2>
            <p>
              Payment is accepted via M-Pesa. An STK push prompt will be sent to your registered phone number. Payment is
              due upon order placement. Invoices are generated automatically and available in your portal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Care and Liability</h2>
            <p>
              We take utmost care in handling your items. However, certain pre-existing conditions (color fading, fabric
              weakening, old stains) may not be fully resolved through cleaning. We are not liable for damage resulting from
              pre-existing wear and tear.
            </p>
            <p>
              In the unlikely event that we damage your item during cleaning, we will compensate you based on the item's
              current market value, up to a maximum of KES 50,000 per item. Claims must be submitted within 48 hours of
              delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Loyalty Program</h2>
            <p>
              Our loyalty program awards points for completed orders. Points can be redeemed for discounts on future orders.
              Points expire 12 months after earning. We reserve the right to modify the loyalty program terms with 30 days
              notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the security of your account credentials. You must provide accurate contact
              information and a valid Kenyan phone number for M-Pesa payments and order notifications. You must be at least
              18 years old to use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Modifications</h2>
            <p>
              We may update these terms from time to time. Continued use of our services after changes constitutes acceptance
              of the updated terms. We will notify registered users of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Republic of Kenya. Any disputes shall be resolved through the
              courts of Nairobi, Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:legal@expresswash.co.ke" className="text-primary hover:underline">
                legal@expresswash.co.ke
              </a>{' '}
              or call +254 700 000 000.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default TermsOfService;
