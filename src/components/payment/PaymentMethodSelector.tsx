/**
 * Payment Method Selector Component
 * Allows users to choose how they want to pay
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Smartphone, Wallet, CreditCard, Building2, QrCode } from 'lucide-react';
import type { PaymentMethod } from '@/types/payment';
import { isValidPhoneNumber, formatPhoneNumber } from '@/services/paymentService';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  phoneNumber?: string;
  onPhoneNumberChange?: (phone: string) => void;
  amount: number;
  showPhoneInput?: boolean;
}

const paymentMethods = [
  {
    value: 'mpesa' as PaymentMethod,
    label: 'M-Pesa',
    description: 'Pay instantly with M-Pesa STK Push',
    icon: Smartphone,
    recommended: true,
  },
  {
    value: 'cash' as PaymentMethod,
    label: 'Cash on Delivery',
    description: 'Pay when your items are delivered',
    icon: Wallet,
    recommended: false,
  },
  {
    value: 'card' as PaymentMethod,
    label: 'Debit/Credit Card',
    description: 'Coming soon',
    icon: CreditCard,
    disabled: true,
  },
  {
    value: 'bank_transfer' as PaymentMethod,
    label: 'Bank Transfer',
    description: 'Coming soon',
    icon: Building2,
    disabled: true,
  },
  {
    value: 'qr_code' as PaymentMethod,
    label: 'QR Code',
    description: 'Coming soon',
    icon: QrCode,
    disabled: true,
  },
];

export function PaymentMethodSelector({
  value,
  onChange,
  phoneNumber = '',
  onPhoneNumberChange,
  amount,
  showPhoneInput = true,
}: PaymentMethodSelectorProps) {
  const [phone, setPhone] = useState(phoneNumber);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    onPhoneNumberChange?.(value);

    // Validate phone number
    if (value && !isValidPhoneNumber(value)) {
      setPhoneError('Invalid phone number. Use format: 0712345678');
    } else {
      setPhoneError(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div>
        <Label className="text-base font-semibold mb-4 block">
          Select Payment Method
        </Label>

        <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;

              return (
                <div
                  key={method.value}
                  className={`
                    relative flex items-start space-x-3 rounded-lg border-2 p-4 transition-all
                    ${value === method.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                    ${method.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  onClick={() => !method.disabled && onChange(method.value)}
                >
                  <RadioGroupItem
                    value={method.value}
                    id={method.value}
                    disabled={method.disabled}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <Label
                        htmlFor={method.value}
                        className={`text-sm font-medium ${
                          method.disabled ? 'text-gray-400' : 'text-gray-900'
                        }`}
                      >
                        {method.label}
                      </Label>
                      {method.recommended && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${
                      method.disabled ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {method.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </div>

      {/* M-Pesa Phone Number Input */}
      {showPhoneInput && (value === 'mpesa' || value === 'qr_code') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <Label htmlFor="phone-number" className="text-sm font-medium text-blue-900">
            M-Pesa Phone Number
          </Label>
          <Input
            id="phone-number"
            type="tel"
            placeholder="0712345678 or +254712345678"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={`${
              phoneError ? 'border-red-500 focus:ring-red-500' : ''
            }`}
          />
          {phoneError && (
            <p className="text-sm text-red-600">{phoneError}</p>
          )}
          <p className="text-xs text-blue-700">
            {value === 'mpesa'
              ? 'You will receive an M-Pesa prompt to pay'
              : 'A QR code will be generated for this number'}
          </p>
        </div>
      )}

      {/* Amount Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Amount:</span>
          <span className="text-2xl font-bold text-gray-900">
            KES {amount.toLocaleString()}
          </span>
        </div>
        {value === 'cash' && (
          <p className="text-xs text-gray-500 mt-2">
            Payment will be collected upon delivery
          </p>
        )}
      </div>
    </div>
  );
}
