import { useSEO } from '@/hooks/useSEO';
import { PageBreadcrumb } from '@/components/shared';

const PrivacyPolicy = () => {
  useSEO({
    title: 'Privacy Policy | Express Carpets & Upholstery',
    description: 'Learn how Express Carpets & Upholstery collects, uses, and protects your personal information including order details and M-Pesa payment data.',
    canonical: 'https://expresscarpets.co.ke/privacy',
  });

  return (
    <div className="flex-1 pt-24 pb-16">
      <div className="container mx-auto max-w-3xl">
        <PageBreadcrumb items={[{ label: 'Privacy Policy' }]} />

        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/80">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              When you use Express Carpets &amp; Upholstery, we collect information you provide directly, including your name, email address,
              phone number, service zone, and pickup/delivery addresses. We also collect order details such as item types,
              dimensions, and payment information processed through M-Pesa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Process and fulfill your cleaning orders</li>
              <li>Coordinate pickup and delivery with our drivers</li>
              <li>Send order status updates via SMS and email</li>
              <li>Process payments and generate invoices</li>
              <li>Manage your loyalty rewards and referral program</li>
              <li>Improve our services and customer experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Information Sharing</h2>
            <p>
              We share your information only as necessary to provide our services. This includes sharing your pickup address
              and contact details with assigned drivers, and processing payments through our banking partner (Credit Bank)
              and M-Pesa. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal data. All data is
              encrypted in transit and at rest. Payment information is processed securely through M-Pesa and is never stored
              on our servers. Access to customer data is restricted to authorized personnel only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
            <p>
              We retain your account information for as long as your account is active. Order history and transaction records
              are retained for a minimum of 7 years as required by Kenyan tax regulations. You may request deletion of your
              account and personal data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to legal retention requirements)</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Cookies and Analytics</h2>
            <p>
              Our website uses essential cookies for authentication and session management. We may use analytics tools to
              understand how customers interact with our platform in order to improve our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Contact Us</h2>
            <p>
              If you have questions about this privacy policy or how we handle your data, please contact us at{' '}
              <a href="mailto:privacy@expresscarpets.co.ke" className="text-primary hover:underline">
                privacy@expresscarpets.co.ke
              </a>{' '}
              or call us at +254 700 000 000.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
