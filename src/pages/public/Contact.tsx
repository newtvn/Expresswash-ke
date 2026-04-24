import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { COMPANY_INFO } from "@/config/constants";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";

/**
 * Contact Page
 * Contact form on the left, company info card on the right.
 */
const Contact = () => {
  useSEO({
    title: "Contact Us | Carpet Cleaning & Sofa Washing — Kitengela, Syokimau, Athi River",
    description: "Contact Express Carpets & Upholstery for professional carpet cleaning, sofa washing, rug cleaning, curtain washing & laundry wash in Kitengela, Syokimau, Athi River & Nairobi. Call or WhatsApp us today.",
    keywords: "contact express carpets, carpet cleaning contact nairobi, sofa washing booking kitengela, expresscarpets phone, expresswash contact, carpet cleaners athi river, carpet cleaning near me",
    canonical: "https://expresscarpets.co.ke/contact",
  });

  // toast imported from sonner at module level
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));

    setIsSubmitting(false);
    setSubmitted(true);
    toast.success("Message sent! We will get back to you within 24 hours.");
  };

  return (
    <main className="flex-1 pt-24 pb-16">
      <div className="container mx-auto">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Contact Us
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Get in Touch
          </h1>
          <p className="text-muted-foreground text-lg">
            Have a question or need a custom quote? Reach out and our team will
            respond within 24 hours.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="grid lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  Send us a message
                </CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Message Sent
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Thank you for reaching out. We will get back to you
                      shortly.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({
                          name: "",
                          email: "",
                          phone: "",
                          message: "",
                        });
                      }}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+254 7XX XXX XXX"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us how we can help..."
                        rows={5}
                        value={formData.message}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Company Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <p className="text-sm text-muted-foreground">
                      {COMPANY_INFO.phone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      WhatsApp available
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {COMPANY_INFO.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Response within 24 hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Address
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {COMPANY_INFO.address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drop-off available
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Business Hours
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Mon - Fri: 7:00 AM - 7:00 PM</p>
                      <p>Saturday: 8:00 AM - 5:00 PM</p>
                      <p>Sunday: 9:00 AM - 2:00 PM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Zones */}
            <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-3">Service Zones</h3>
                <ul className="space-y-2 text-sm text-primary-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Kitengela - Same Day
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Athi River & Syokimau - Same Day
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Greater Nairobi - 48 Hours
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Contact;
