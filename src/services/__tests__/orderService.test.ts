import { describe, it, expect } from 'vitest';
import {
  calculateETA,
  getDeliveryFee,
  getPricePerSqInch,
  calculateItemPrice,
  PRICING,
} from '../orderService';

describe('orderService - Pricing Calculations', () => {
  describe('calculateETA', () => {
    it('should return same/next day for Kitengela zone', () => {
      const result = calculateETA('Kitengela');
      expect(result.label).toBe('Same Day / Next Day');
    });

    it('should return same/next day for Athi River zone', () => {
      const result = calculateETA('Athi River');
      expect(result.label).toBe('Same Day / Next Day');
    });

    it('should return same/next day for Syokimau zone', () => {
      const result = calculateETA('Syokimau');
      expect(result.label).toBe('Same Day / Next Day');
    });

    it('should return 1-2 days for Nairobi zone', () => {
      const result = calculateETA('Nairobi CBD');
      expect(result.label).toBe('1-2 Business Days');
    });

    it('should return 2-3 days for unknown zones', () => {
      const result = calculateETA('Mombasa');
      expect(result.label).toBe('2-3 Business Days');
    });

    it('should skip weekends when calculating ETA', () => {
      const result = calculateETA('Kitengela');
      const etaDate = new Date(result.date);
      const dayOfWeek = etaDate.getDay();
      // Should not be Saturday (6) or Sunday (0)
      expect(dayOfWeek).not.toBe(0);
      expect(dayOfWeek).not.toBe(6);
    });

    it('should be case-insensitive for zone matching', () => {
      const result1 = calculateETA('KITENGELA');
      const result2 = calculateETA('kitengela');
      const result3 = calculateETA('Kitengela');
      expect(result1.label).toBe(result2.label);
      expect(result2.label).toBe(result3.label);
    });
  });

  describe('getDeliveryFee', () => {
    it('should return 300 KES for Kitengela', () => {
      expect(getDeliveryFee('Kitengela')).toBe(300);
    });

    it('should return 300 KES for Athi River', () => {
      expect(getDeliveryFee('Athi River')).toBe(300);
    });

    it('should return 350 KES for Syokimau', () => {
      expect(getDeliveryFee('Syokimau')).toBe(350);
    });

    it('should return 500 KES for Nairobi', () => {
      expect(getDeliveryFee('Nairobi CBD')).toBe(500);
    });

    it('should return 600 KES for unknown zones (default)', () => {
      expect(getDeliveryFee('Mombasa')).toBe(600);
      expect(getDeliveryFee('Unknown Zone')).toBe(600);
    });

    it('should be case-insensitive for zone matching', () => {
      expect(getDeliveryFee('KITENGELA')).toBe(300);
      expect(getDeliveryFee('kitengela')).toBe(300);
      expect(getDeliveryFee('KiTeNgElA')).toBe(300);
    });

    it('should match zones within longer strings', () => {
      expect(getDeliveryFee('Greater Kitengela Area')).toBe(300);
      expect(getDeliveryFee('Nairobi West')).toBe(500);
    });
  });

  describe('getPricePerSqInch', () => {
    it('should return correct price for carpet (0.35)', () => {
      expect(getPricePerSqInch('carpet')).toBe(0.35);
    });

    it('should return correct price for rug (0.40)', () => {
      expect(getPricePerSqInch('rug')).toBe(0.40);
    });

    it('should return correct price for curtain (0.30)', () => {
      expect(getPricePerSqInch('curtain')).toBe(0.30);
    });

    it('should return correct price for sofa (0.50)', () => {
      expect(getPricePerSqInch('sofa')).toBe(0.50);
    });

    it('should return correct price for mattress (0.25)', () => {
      expect(getPricePerSqInch('mattress')).toBe(0.25);
    });

    it('should return correct price for chair (0.45)', () => {
      expect(getPricePerSqInch('chair')).toBe(0.45);
    });

    it('should return correct price for pillow (0.20)', () => {
      expect(getPricePerSqInch('pillow')).toBe(0.20);
    });

    it('should return default price (0.35) for unknown item types', () => {
      expect(getPricePerSqInch('unknown-item')).toBe(0.35);
      expect(getPricePerSqInch('tablecloth')).toBe(0.35);
    });

    it('should be case-insensitive for item type matching', () => {
      expect(getPricePerSqInch('CARPET')).toBe(0.35);
      expect(getPricePerSqInch('Carpet')).toBe(0.35);
      expect(getPricePerSqInch('CaRpEt')).toBe(0.35);
    });
  });

  describe('calculateItemPrice', () => {
    it('should calculate correct price for a 60x40 carpet (quantity 1)', () => {
      const result = calculateItemPrice('carpet', 60, 40, 1);
      // 60 * 40 = 2400 sq inches
      // 2400 * 0.35 = 840
      // Math.round(840) = 840
      // 840 * 1 = 840
      expect(result.sqInches).toBe(2400);
      expect(result.pricePerSqInch).toBe(0.35);
      expect(result.unitPrice).toBe(840);
      expect(result.totalPrice).toBe(840);
    });

    it('should calculate correct price for multiple items (quantity 3)', () => {
      const result = calculateItemPrice('pillow', 20, 20, 3);
      // 20 * 20 = 400 sq inches
      // 400 * 0.20 = 80
      // Math.round(80) = 80
      // 80 * 3 = 240
      expect(result.sqInches).toBe(400);
      expect(result.pricePerSqInch).toBe(0.20);
      expect(result.unitPrice).toBe(80);
      expect(result.totalPrice).toBe(240);
    });

    it('should round unit price correctly for decimal results', () => {
      const result = calculateItemPrice('sofa', 55, 30, 1);
      // 55 * 30 = 1650 sq inches
      // 1650 * 0.50 = 825.0
      // Math.round(825.0) = 825
      expect(result.unitPrice).toBe(825);
      expect(result.totalPrice).toBe(825);
    });

    it('should handle large items correctly', () => {
      const result = calculateItemPrice('mattress', 80, 60, 2);
      // 80 * 60 = 4800 sq inches
      // 4800 * 0.25 = 1200
      // Math.round(1200) = 1200
      // 1200 * 2 = 2400
      expect(result.sqInches).toBe(4800);
      expect(result.pricePerSqInch).toBe(0.25);
      expect(result.unitPrice).toBe(1200);
      expect(result.totalPrice).toBe(2400);
    });

    it('should handle small items correctly', () => {
      const result = calculateItemPrice('pillow', 12, 12, 4);
      // 12 * 12 = 144 sq inches
      // 144 * 0.20 = 28.8
      // Math.round(28.8) = 29
      // 29 * 4 = 116
      expect(result.sqInches).toBe(144);
      expect(result.pricePerSqInch).toBe(0.20);
      expect(result.unitPrice).toBe(29);
      expect(result.totalPrice).toBe(116);
    });

    it('should use default price for unknown item types', () => {
      const result = calculateItemPrice('tablecloth', 48, 36, 1);
      // 48 * 36 = 1728 sq inches
      // 1728 * 0.35 = 604.8
      // Math.round(604.8) = 605
      expect(result.pricePerSqInch).toBe(0.35);
      expect(result.unitPrice).toBe(605);
    });

    it('should handle zero quantity correctly', () => {
      const result = calculateItemPrice('carpet', 60, 40, 0);
      expect(result.totalPrice).toBe(0);
    });
  });

  describe('PRICING constants', () => {
    it('should have VAT rate of 16%', () => {
      expect(PRICING.vatRate).toBe(0.16);
    });

    it('should have minimum order of 500 KES', () => {
      expect(PRICING.minimumOrder).toBe(500);
    });

    it('should have all required item types', () => {
      expect(PRICING.pricePerSqInch).toHaveProperty('carpet');
      expect(PRICING.pricePerSqInch).toHaveProperty('rug');
      expect(PRICING.pricePerSqInch).toHaveProperty('curtain');
      expect(PRICING.pricePerSqInch).toHaveProperty('sofa');
      expect(PRICING.pricePerSqInch).toHaveProperty('mattress');
      expect(PRICING.pricePerSqInch).toHaveProperty('chair');
      expect(PRICING.pricePerSqInch).toHaveProperty('pillow');
      expect(PRICING.pricePerSqInch).toHaveProperty('other');
    });

    it('should have all required delivery zones', () => {
      expect(PRICING.deliveryFees).toHaveProperty('kitengela');
      expect(PRICING.deliveryFees).toHaveProperty('athi river');
      expect(PRICING.deliveryFees).toHaveProperty('syokimau');
      expect(PRICING.deliveryFees).toHaveProperty('nairobi');
      expect(PRICING.deliveryFees).toHaveProperty('other');
    });
  });

  describe('Real-world pricing scenarios', () => {
    it('should calculate correct total for a typical carpet order', () => {
      // Customer orders: 1 large carpet (72x48 inches)
      const carpet = calculateItemPrice('carpet', 72, 48, 1);
      const subtotal = carpet.totalPrice;
      const deliveryFee = getDeliveryFee('Nairobi');
      const vat = Math.round((subtotal + deliveryFee) * PRICING.vatRate);
      const total = subtotal + deliveryFee + vat;

      // 72 * 48 = 3456 sq inches
      // 3456 * 0.35 = 1209.6 → 1210 KES
      // Delivery: 500 KES
      // VAT: (1210 + 500) * 0.16 = 273.6 → 274 KES
      // Total: 1210 + 500 + 274 = 1984 KES
      expect(carpet.unitPrice).toBe(1210);
      expect(deliveryFee).toBe(500);
      expect(vat).toBe(274);
      expect(total).toBe(1984);
    });

    it('should calculate correct total for multiple sofa cushions', () => {
      // Customer orders: 4 sofa cushions (24x24 inches each)
      const cushions = calculateItemPrice('sofa', 24, 24, 4);
      const subtotal = cushions.totalPrice;
      const deliveryFee = getDeliveryFee('Kitengela');
      const vat = Math.round((subtotal + deliveryFee) * PRICING.vatRate);
      const total = subtotal + deliveryFee + vat;

      // 24 * 24 = 576 sq inches
      // 576 * 0.50 = 288 KES per cushion
      // 288 * 4 = 1152 KES
      // Delivery: 300 KES
      // VAT: (1152 + 300) * 0.16 = 232.32 → 232 KES
      // Total: 1152 + 300 + 232 = 1684 KES
      expect(cushions.unitPrice).toBe(288);
      expect(cushions.totalPrice).toBe(1152);
      expect(deliveryFee).toBe(300);
      expect(vat).toBe(232);
      expect(total).toBe(1684);
    });

    it('should meet minimum order requirement', () => {
      // Small order: 1 small pillow (15x15 inches)
      const pillow = calculateItemPrice('pillow', 15, 15, 1);
      const deliveryFee = getDeliveryFee('Kitengela');
      const subtotal = pillow.totalPrice + deliveryFee;

      // 15 * 15 = 225 sq inches
      // 225 * 0.20 = 45 KES
      // 45 + 300 = 345 KES (below minimum of 500 KES)
      expect(pillow.totalPrice).toBe(45);
      expect(subtotal).toBeLessThan(PRICING.minimumOrder);
    });
  });
});
