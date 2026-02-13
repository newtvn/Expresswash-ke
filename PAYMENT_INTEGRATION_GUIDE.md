# 💳 STK Push Payment Integration Guide for ExpressWash

## 📋 Table of Contents
1. [Overview](#overview)
2. [How STK Push Works](#how-stk-push-works)
3. [Architecture](#architecture)
4. [Authentication Flow](#authentication-flow)
5. [Integration Flow](#integration-flow)
6. [Callback Mechanism](#callback-mechanism)
7. [Implementation Steps](#implementation-steps)
8. [Security Considerations](#security-considerations)
9. [Testing](#testing)
10. [FAQs](#faqs)

---

## 🎯 Overview

**STK Push** (Sim Toolkit Push) is a feature that allows you to **prompt customers to pay directly via M-Pesa**. Instead of customers manually sending money, they receive a payment request on their phone and just need to enter their M-Pesa PIN.

### What You've Been Given

Based on the Co-operative Bank API documentation, you have access to:

1. **STK Push Endpoint** - `/payment/mpesa/stkpush`
   - Sends payment prompt to customer's phone
   - Customer enters PIN to complete payment
   - Real-time payment notification

2. **QR Code Endpoint** - `/payment/mpesa/qrcode`
   - Generates QR code for payment
   - Customer scans with M-Pesa app
   - Alternative to STK Push

---

## 🔄 How STK Push Works

### Complete Payment Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Customer  │         │  Your App   │         │ Your Backend│         │  Bank API   │
│   (Phone)   │         │  (Frontend) │         │   (Server)  │         │  (Co-op)    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │                       │
       │  1. Click "Pay"       │                       │                       │
       ├──────────────────────>│                       │                       │
       │                       │                       │                       │
       │                       │  2. Send Payment      │                       │
       │                       │     Request           │                       │
       │                       ├──────────────────────>│                       │
       │                       │                       │                       │
       │                       │                       │  3. Get Access Token  │
       │                       │                       ├──────────────────────>│
       │                       │                       │<──────────────────────┤
       │                       │                       │   Token Response      │
       │                       │                       │                       │
       │                       │                       │  4. STK Push Request  │
       │                       │                       ├──────────────────────>│
       │                       │                       │<──────────────────────┤
       │                       │                       │   Checkout Request ID │
       │                       │<──────────────────────┤                       │
       │                       │  5. Return Request ID │                       │
       │                       │                       │                       │
       │  6. M-Pesa Popup     ←┼───────────────────────┼───────────────────────┤
       │  "Pay KES 1,500?"     │                       │                       │
       │                       │                       │                       │
       │  7. Enter PIN         │                       │                       │
       ├───────────────────────┼───────────────────────┼──────────────────────>│
       │                       │                       │                       │
       │  8. Confirmation SMS  │                       │                       │
       │<──────────────────────┼───────────────────────┼───────────────────────┤
       │                       │                       │                       │
       │                       │                       │  9. Payment Callback  │
       │                       │                       │<──────────────────────┤
       │                       │                       │    (Webhook)          │
       │                       │                       │                       │
       │                       │  10. Update Order     │                       │
       │                       │<──────────────────────┤                       │
       │                       │   Status: Paid        │                       │
       │                       │                       │                       │
       │  11. Show Success     │                       │                       │
       │<──────────────────────┤                       │                       │
       │                       │                       │                       │
```

### Key Timing

- **Step 1-5**: ~2-3 seconds (API calls)
- **Step 6-8**: 10-60 seconds (customer enters PIN)
- **Step 9**: ~1-2 seconds (callback to your server)
- **Step 10-11**: Instant (update UI)

**Total Time**: 15-65 seconds (depends on how fast customer enters PIN)

---

## 🏗️ Architecture

### ⚠️ CRITICAL: Frontend vs Backend

**🚨 NEVER put API credentials in frontend code!**

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│  (React - Exposed to Users)                                   │
│                                                               │
│  ✅ Can Do:                                                   │
│   - Collect phone number and amount                          │
│   - Display payment UI                                        │
│   - Call YOUR backend API                                     │
│   - Show payment status                                       │
│                                                               │
│  ❌ NEVER Do:                                                 │
│   - Store API credentials (consumer key/secret)              │
│   - Call bank API directly                                    │
│   - Expose sensitive data                                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│  (Node.js/Supabase Edge Functions - Secure)                  │
│                                                               │
│  ✅ Must Do:                                                  │
│   - Store API credentials securely                            │
│   - Authenticate with bank API                                │
│   - Initiate STK Push                                         │
│   - Receive payment callbacks                                 │
│   - Verify payments                                           │
│   - Update order status                                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + OAuth
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    BANK API (Co-op Bank)                      │
│  - Processes payments                                         │
│  - Sends STK Push to customer                                 │
│  - Sends callbacks to your server                             │
└──────────────────────────────────────────────────────────────┘
```

### Recommended Backend Options

**Option 1: Supabase Edge Functions** (Recommended for your stack)
```typescript
// Supabase Edge Function: functions/stk-push/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // 1. Get bank credentials from environment variables
  // 2. Authenticate with bank API
  // 3. Initiate STK Push
  // 4. Return checkout request ID
})
```

**Option 2: Node.js/Express Server**
```javascript
// server.js
const express = require('express');
const app = express();

app.post('/api/payment/stk-push', async (req, res) => {
  // Handle STK Push
});

app.post('/api/payment/callback', async (req, res) => {
  // Handle bank callback
});
```

**Option 3: Serverless Functions (Vercel/Netlify)**
```javascript
// api/stk-push.js
export default async function handler(req, res) {
  // Handle STK Push
}
```

---

## 🔐 Authentication Flow

### 1. Get API Credentials

You need these from Co-operative Bank:

```env
BANK_CONSUMER_KEY=your-consumer-key-here
BANK_CONSUMER_SECRET=your-consumer-secret-here
BANK_ACCOUNT_NUMBER=your-account-number
BANK_API_BASE_URL=https://api.co-opbank.co.ke
```

### 2. Obtain Access Token

**Endpoint**: `POST /oauth/token`

**Request**:
```bash
curl -X POST https://api.co-opbank.co.ke/oauth/token \
  -H "Authorization: Basic BASE64(consumer_key:consumer_secret)" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Important Notes**:
- ✅ Token expires in 1 hour (3600 seconds)
- ✅ Cache the token and reuse it
- ✅ Refresh when expired
- ❌ Don't request new token for every payment

### 3. Token Management Strategy

```typescript
// Backend: Token cache
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry > Date.now()) {
    return cachedToken;
  }

  // Request new token
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const response = await fetch(`${API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });

  const data = await response.json();

  // Cache token
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

  return cachedToken;
}
```

---

## 🔄 Integration Flow

### Frontend Flow (React Component)

```typescript
// Example: Customer orders and clicks "Pay with M-Pesa"
import { useSTKPush } from '@/hooks/usePayment';

function CheckoutPage() {
  const { initiatePayment, isLoading, response } = useSTKPush();
  const [phone, setPhone] = useState('');

  const handlePayment = async () => {
    // 1. Validate inputs
    if (!phone || phone.length < 10) {
      alert('Enter valid phone number');
      return;
    }

    // 2. Initiate STK Push (calls your backend)
    const result = await initiatePayment({
      phoneNumber: phone,
      amount: orderTotal,
      accountReference: orderId,
      transactionDesc: `Payment for Order #${orderId}`,
    });

    // 3. Show status
    if (result.success) {
      // Customer sees: "Check your phone for M-Pesa prompt"
      startPollingPaymentStatus(result.checkoutRequestId);
    }
  };

  return (
    <div>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="0712345678"
      />
      <button onClick={handlePayment} disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Pay KES 1,500'}
      </button>
    </div>
  );
}
```

### Backend Flow (API Endpoint)

```typescript
// Supabase Edge Function or Express endpoint
async function handleSTKPush(request) {
  const { phoneNumber, amount, accountReference, transactionDesc } = request;

  // 1. Validate inputs
  if (!phoneNumber || !amount) {
    return { error: 'Missing required fields' };
  }

  // 2. Format phone number (254XXXXXXXXX)
  const formattedPhone = formatPhoneNumber(phoneNumber);

  // 3. Get access token
  const accessToken = await getAccessToken();

  // 4. Call bank STK Push API
  const response = await fetch(`${BANK_API_URL}/v1/payment/stk-push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: formattedPhone,
      amount: amount.toFixed(2),
      accountReference: accountReference,
      transactionDesc: transactionDesc,
      callbackUrl: 'https://your-backend.com/api/payment/callback',
    }),
  });

  const data = await response.json();

  // 5. Store payment record in database
  await supabase.from('payments').insert({
    order_id: accountReference,
    checkout_request_id: data.checkoutRequestId,
    merchant_request_id: data.merchantRequestId,
    amount: amount,
    phone_number: formattedPhone,
    status: 'processing',
    created_at: new Date().toISOString(),
  });

  // 6. Return checkout request ID to frontend
  return {
    success: true,
    checkoutRequestId: data.checkoutRequestId,
    message: 'STK Push sent successfully',
  };
}
```

---

## 📞 Callback Mechanism

### Why Callbacks Are Critical

**Callbacks** are how the bank **notifies you when payment completes**. Without callbacks, you'd have to constantly poll the API to check if the customer paid (inefficient and unreliable).

### Callback Flow

```
Customer Pays → Bank Receives Payment → Bank Sends Callback to Your Server
                                      ↓
                              Your Server Updates Order Status
                                      ↓
                              Frontend Shows "Payment Successful"
```

### Setting Up Callback Endpoint

**Your Backend Endpoint**: `POST /api/payment/callback`

```typescript
// Express example
app.post('/api/payment/callback', async (req, res) => {
  const callback = req.body;

  console.log('Payment callback received:', callback);

  // Callback structure (from Co-op Bank):
  // {
  //   merchantRequestId: "...",
  //   checkoutRequestId: "...",
  //   resultCode: 0,  // 0 = success, other = failed
  //   resultDesc: "The service request is processed successfully.",
  //   amount: 1500.00,
  //   mpesaReceiptNumber: "QGR7I8K9LM",  // M-Pesa transaction ID
  //   transactionDate: "2024-01-15T14:30:00",
  //   phoneNumber: "254712345678"
  // }

  // 1. Determine payment status
  const status = callback.resultCode === 0 ? 'completed' : 'failed';

  // 2. Update payment record
  await supabase
    .from('payments')
    .update({
      status: status,
      transaction_id: callback.mpesaReceiptNumber,
      completed_at: new Date().toISOString(),
      result_code: callback.resultCode,
      result_desc: callback.resultDesc,
    })
    .eq('checkout_request_id', callback.checkoutRequestId);

  // 3. If successful, update order status
  if (status === 'completed') {
    // Get payment details
    const { data: payment } = await supabase
      .from('payments')
      .select('order_id')
      .eq('checkout_request_id', callback.checkoutRequestId)
      .single();

    // Update order
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 2, // Move to next stage (driver_assigned)
      })
      .eq('id', payment.order_id);

    // Send confirmation SMS/email to customer
    await sendPaymentConfirmation(payment.order_id);
  }

  // 4. Always acknowledge callback (important!)
  res.status(200).json({ success: true });
});
```

### Callback URL Requirements

1. **Must be HTTPS** (not HTTP) - Bank won't send to insecure endpoints
2. **Must be publicly accessible** - Not localhost or private IP
3. **Must respond quickly** - Return 200 status within 5 seconds
4. **Must handle retries** - Bank may send same callback multiple times

### Testing Callbacks Locally

**Problem**: Bank can't reach `localhost` for callbacks

**Solution**: Use ngrok or similar tunneling service

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Output:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000
#
# Use https://abc123.ngrok.io/api/payment/callback as callback URL
```

---

## 📝 Implementation Steps

### Step 1: Get API Credentials

**From Co-operative Bank**:
1. Sign up for developer account
2. Create application
3. Get:
   - Consumer Key
   - Consumer Secret
   - Account Number
   - API Base URL

### Step 2: Create Database Schema

```sql
-- Add payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  method payment_method NOT NULL DEFAULT 'mpesa',
  status payment_status NOT NULL DEFAULT 'pending',
  phone_number TEXT,
  transaction_id TEXT, -- M-Pesa receipt number
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  reference_number TEXT,
  result_code INTEGER,
  result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add index for faster queries
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_checkout_request_id ON payments(checkout_request_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Add payment_status to orders table
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
```

### Step 3: Set Up Backend (Supabase Edge Function)

```bash
# Create Supabase Edge Function
supabase functions new stk-push
supabase functions new payment-callback
```

**File**: `supabase/functions/stk-push/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { phoneNumber, amount, orderId } = await req.json();

    // Get bank credentials from environment
    const BANK_KEY = Deno.env.get('BANK_CONSUMER_KEY');
    const BANK_SECRET = Deno.env.get('BANK_CONSUMER_SECRET');
    const BANK_URL = Deno.env.get('BANK_API_BASE_URL');

    // 1. Get access token
    const credentials = btoa(`${BANK_KEY}:${BANK_SECRET}`);
    const tokenResponse = await fetch(`${BANK_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });

    const { access_token } = await tokenResponse.json();

    // 2. Initiate STK Push
    const stkResponse = await fetch(`${BANK_URL}/v1/payment/stk-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber.replace(/^0/, '254'),
        amount: Number(amount).toFixed(2),
        accountReference: orderId,
        transactionDesc: `ExpressWash Order #${orderId}`,
        callbackUrl: `${Deno.env.get('CALLBACK_BASE_URL')}/payment-callback`,
      }),
    });

    const stkData = await stkResponse.json();

    // 3. Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('payments').insert({
      order_id: orderId,
      amount: amount,
      phone_number: phoneNumber,
      checkout_request_id: stkData.checkoutRequestId,
      merchant_request_id: stkData.merchantRequestId,
      status: 'processing',
    });

    return new Response(JSON.stringify({
      success: true,
      checkoutRequestId: stkData.checkoutRequestId,
      message: 'STK Push sent successfully',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

**File**: `supabase/functions/payment-callback/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const callback = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const status = callback.resultCode === 0 ? 'completed' : 'failed';

  // Update payment
  await supabase
    .from('payments')
    .update({
      status: status,
      transaction_id: callback.mpesaReceiptNumber,
      result_code: callback.resultCode,
      result_desc: callback.resultDesc,
      completed_at: new Date().toISOString(),
    })
    .eq('checkout_request_id', callback.checkoutRequestId);

  // Update order if payment successful
  if (status === 'completed') {
    const { data: payment } = await supabase
      .from('payments')
      .select('order_id')
      .eq('checkout_request_id', callback.checkoutRequestId)
      .single();

    await supabase
      .from('orders')
      .update({ payment_status: 'paid', status: 2 })
      .eq('id', payment.order_id);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Deploy Functions**:
```bash
supabase functions deploy stk-push
supabase functions deploy payment-callback
```

### Step 4: Update Frontend Service

**Update**: `src/services/paymentService.ts`

Replace API calls to call your Supabase Edge Functions instead:

```typescript
export async function initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
  try {
    // Call YOUR backend, not bank directly
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stk-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(request),
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      errorMessage: 'Payment initiation failed',
    };
  }
}
```

### Step 5: Add Payment to Checkout Flow

**Update**: Order creation to include payment

```typescript
// src/pages/customer/Checkout.tsx
import { useSTKPush } from '@/hooks/usePayment';

function Checkout() {
  const { initiatePayment, isLoading } = useSTKPush();
  const [paymentMethod, setPaymentMethod] = useState('mpesa');

  const handlePlaceOrder = async () => {
    // 1. Create order first
    const order = await createOrder({
      items: cartItems,
      total: orderTotal,
      // ... other details
    });

    // 2. Initiate payment if M-Pesa selected
    if (paymentMethod === 'mpesa') {
      const paymentResult = await initiatePayment({
        phoneNumber: customerPhone,
        amount: orderTotal,
        accountReference: order.id,
        transactionDesc: `Payment for Order #${order.trackingCode}`,
      });

      if (paymentResult.success) {
        // Show payment prompt
        setShowPaymentModal(true);

        // Poll for payment status
        startPolling(paymentResult.checkoutRequestId);
      }
    } else {
      // Cash on delivery - just create order
      router.push(`/customer/orders/${order.id}`);
    }
  };

  return (
    <div>
      {/* Payment method selection */}
      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
        <option value="mpesa">M-Pesa (Pay Now)</option>
        <option value="cash">Cash on Delivery</option>
      </select>

      <button onClick={handlePlaceOrder} disabled={isLoading}>
        {isLoading ? 'Processing Payment...' : 'Place Order'}
      </button>
    </div>
  );
}
```

### Step 6: Environment Variables

**Add to Vercel/Production**:

```env
# Supabase Edge Functions Environment Variables
BANK_CONSUMER_KEY=your-consumer-key
BANK_CONSUMER_SECRET=your-consumer-secret
BANK_API_BASE_URL=https://api.co-opbank.co.ke
BANK_ACCOUNT_NUMBER=your-account-number
CALLBACK_BASE_URL=https://your-project.supabase.co/functions/v1
```

---

## 🔒 Security Considerations

### 1. Never Expose Credentials

❌ **NEVER**:
```typescript
// DON'T DO THIS!
const CONSUMER_KEY = 'abc123'; // Exposed in frontend code
```

✅ **ALWAYS**:
```typescript
// Backend only
const CONSUMER_KEY = process.env.BANK_CONSUMER_KEY;
```

### 2. Validate Callbacks

```typescript
// Verify callback authenticity
function isValidCallback(callback) {
  // 1. Check IP address (bank's IP whitelist)
  // 2. Verify signature if provided
  // 3. Check timestamps
  return true;
}
```

### 3. Prevent Duplicate Payments

```typescript
// Check if payment already processed
const existingPayment = await supabase
  .from('payments')
  .select('*')
  .eq('checkout_request_id', checkoutRequestId)
  .eq('status', 'completed')
  .single();

if (existingPayment) {
  return { error: 'Payment already processed' };
}
```

### 4. Amount Validation

```typescript
// Verify amount matches order total
const order = await getOrder(orderId);
if (callback.amount !== order.total) {
  console.error('Amount mismatch!');
  // Alert admin, don't auto-complete order
}
```

---

## 🧪 Testing

### Test Environments

**Sandbox** (Testing):
- Use test phone numbers
- No real money transferred
- Instant responses

**Production**:
- Real phone numbers
- Real money
- Live transactions

### Test Phone Numbers (Sandbox)

Bank typically provides test numbers like:
- `254700000000` - Always succeeds
- `254700000001` - Always fails (insufficient funds)
- `254700000002` - Always timeout

### Testing Checklist

- [ ] STK Push sends successfully
- [ ] Customer receives M-Pesa prompt
- [ ] Payment completes on PIN entry
- [ ] Callback received and processed
- [ ] Order status updates to "Paid"
- [ ] Customer sees confirmation
- [ ] Failed payment handled gracefully
- [ ] Timeout scenario handled
- [ ] Duplicate payment prevention works
- [ ] Amount validation works

### Testing Script

```typescript
// test-payment.ts
async function testPayment() {
  console.log('1. Initiating STK Push...');

  const result = await initiateSTKPush({
    phoneNumber: '254700000000', // Test number
    amount: 100,
    accountReference: 'TEST_ORDER_123',
    transactionDesc: 'Test Payment',
  });

  console.log('Result:', result);

  if (result.success) {
    console.log('2. Waiting for callback...');

    // Poll for status
    const checkoutRequestId = result.checkoutRequestId;
    const interval = setInterval(async () => {
      const status = await queryPaymentStatus({ checkoutRequestId });
      console.log('Status:', status);

      if (status.status !== 'processing') {
        clearInterval(interval);
        console.log('3. Payment completed:', status);
      }
    }, 3000);
  }
}
```

---

## ❓ FAQs

### Q1: What if customer cancels payment?

**A**: Callback will have `resultCode !== 0`. Mark payment as `cancelled` and allow retry.

### Q2: What if callback never arrives?

**A**: Implement timeout (2 minutes). Then query payment status manually using `/payment/query` endpoint.

### Q3: Can customer pay partial amount?

**A**: No, STK Push is all-or-nothing. For partial payments, create separate payment requests.

### Q4: What about refunds?

**A**: Requires separate refund API call. Not automatic.

### Q5: How to handle network timeouts?

**A**:
1. Set timeout (60 seconds for STK Push)
2. Save payment as `pending` in database
3. Query status after timeout
4. Update accordingly

### Q6: Can I customize M-Pesa prompt message?

**A**: Yes, via `transactionDesc` parameter. Keep it short (max 20 characters shown on some phones).

### Q7: What Result Codes exist?

Common codes:
- `0` - Success
- `1` - Insufficient balance
- `1032` - User cancelled
- `1037` - Timeout (user didn't enter PIN)
- `2001` - Invalid phone number

---

## 📊 Monitoring & Analytics

### Track These Metrics

```typescript
// Payment analytics
const paymentStats = {
  totalInitiated: 150,
  successfulPayments: 130,
  failedPayments: 15,
  cancelledByUser: 5,
  successRate: '86.7%',
  averageTime: '23 seconds',
  totalRevenue: 195000, // KES
};
```

### Alert Triggers

- ✅ Success rate drops below 80%
- ✅ Callback delays > 5 minutes
- ✅ Multiple failures from same customer
- ✅ Amount mismatches

---

## 🎯 Summary

### What You Need

1. **Bank Credentials** - Consumer key, secret, account number
2. **Backend Server** - Supabase Edge Functions or Node.js
3. **Public Callback URL** - HTTPS endpoint for payment confirmations
4. **Database** - Store payment records
5. **Frontend Integration** - UI for collecting phone numbers

### Integration Steps

1. ✅ Get API credentials from Co-op Bank
2. ✅ Create database schema for payments
3. ✅ Set up backend (Supabase Edge Functions)
4. ✅ Implement STK Push endpoint
5. ✅ Implement callback endpoint
6. ✅ Update frontend payment UI
7. ✅ Test in sandbox environment
8. ✅ Deploy to production
9. ✅ Monitor and optimize

### Files Created for You

- ✅ `src/types/payment.ts` - TypeScript types
- ✅ `src/services/paymentService.ts` - Payment service functions
- ✅ `src/hooks/usePayment.ts` - React hooks for easy integration

**Next**: Create backend endpoints and test with real credentials!

---

**Need Help?**
- Check Co-op Bank API documentation
- Contact their developer support
- Test thoroughly in sandbox before going live
