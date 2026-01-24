import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Layers, 
  Armchair, 
  Blinds,
  RectangleHorizontal,
  Sofa,
  BedDouble,
  Minus,
  Plus,
  ArrowRight
} from "lucide-react";

const items = [
  { id: "carpet-small", icon: Layers, name: "Carpet (Small)", price: 500, unit: "per item" },
  { id: "carpet-large", icon: Layers, name: "Carpet (Large)", price: 800, unit: "per item" },
  { id: "chair", icon: Armchair, name: "Chair", price: 300, unit: "per item" },
  { id: "curtain", icon: Blinds, name: "Curtain Pair", price: 400, unit: "per pair" },
  { id: "rug", icon: RectangleHorizontal, name: "Rug", price: 450, unit: "per item" },
  { id: "sofa-2seater", icon: Sofa, name: "Sofa (2-Seater)", price: 800, unit: "per item" },
  { id: "sofa-3seater", icon: Sofa, name: "Sofa (3-Seater)", price: 1200, unit: "per item" },
  { id: "mattress", icon: BedDouble, name: "Mattress", price: 600, unit: "per item" },
];

const zones = [
  { id: "kitengela", name: "Kitengela", multiplier: 1, delivery: "Same Day" },
  { id: "athiriver", name: "Athi River", multiplier: 1, delivery: "Same Day" },
  { id: "nairobi", name: "Greater Nairobi", multiplier: 1.1, delivery: "48 Hours" },
];

const PricingCalculator = () => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState(zones[0]);

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [itemId]: newValue };
    });
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + (quantities[item.id] || 0) * item.price;
  }, 0);

  const total = Math.round(subtotal * selectedZone.multiplier);
  const vat = Math.round(total * 0.16);
  const grandTotal = total + vat;

  const itemCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  return (
    <section id="pricing" className="py-24 bg-secondary/30">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Get an Instant Quote
          </h2>
          <p className="text-muted-foreground text-lg">
            Select your items and delivery zone to see your estimated price.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Item Selection */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Select Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {items.map((item) => {
                    const quantity = quantities[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          quantity > 0 
                            ? "border-primary/30 bg-primary/5" 
                            : "border-border bg-background hover:border-primary/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            quantity > 0 ? "bg-primary" : "bg-secondary"
                          }`}>
                            <item.icon className={`w-5 h-5 ${
                              quantity > 0 ? "text-primary-foreground" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              KES {item.price} {item.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                            disabled={quantity === 0}
                          >
                            <Minus className="w-4 h-4 text-foreground" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-4 h-4 text-primary-foreground" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Zone Selection */}
            <Card className="bg-card border-border/50 mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Delivery Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {zones.map((zone) => (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZone(zone)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedZone.id === zone.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{zone.name}</p>
                      <p className="text-xs text-muted-foreground">{zone.delivery}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quote Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border/50 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Your Quote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {itemCount > 0 ? (
                  <>
                    <div className="space-y-3">
                      {items
                        .filter((item) => quantities[item.id] > 0)
                        .map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.name} x {quantities[item.id]}
                            </span>
                            <span className="text-foreground font-medium">
                              KES {(quantities[item.id] || 0) * item.price}
                            </span>
                          </div>
                        ))}
                    </div>

                    <div className="border-t border-border pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">KES {total}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT (16%)</span>
                        <span className="text-foreground">KES {vat}</span>
                      </div>
                      {selectedZone.multiplier > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Zone Adjustment</span>
                          <span className="text-foreground">+10%</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between">
                        <span className="text-lg font-semibold text-foreground">Total</span>
                        <span className="text-lg font-bold text-primary">
                          KES {grandTotal.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedZone.delivery} delivery to {selectedZone.name}
                      </p>
                    </div>

                    <Button variant="hero" className="w-full" size="lg">
                      Book Now
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      Select items to see your quote
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingCalculator;
