# 🚀 Payment System Setup Guide

Complete step-by-step guide to set up STK Push payments for ExpressWash.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ Co-operative Bank API credentials (Consumer Key, Secret, Account Number)
- ✅ Supabase project created
- ✅ Supabase CLI installed (`npm install -g supabase`)
- ✅ Git repository cloned
- ✅ Node.js 18+ installed

---

## 🎯 Step 1: Database Setup

### Run Migration SQL

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run Migration**
   - Copy entire contents of `supabase-migration-payments.sql`
   - Paste into SQL Editor
   - Click "Run"

4. **Verify Tables Created**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name = 'payments';
   ```

   Should return: `payments` table

---

## 🔧 Step 2: Supabase Edge Functions Setup

### Install Supabase CLI

```bash
# Install globally
npm install -g supabase

# Login to Supabase
supabase login
```

### Link Your Project

```bash
# In your project directory
cd /path/to/Expresswash-ke

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Your project ref is in the URL:
# https://supabase.com/dashboard/project/[YOUR_PROJECT_REF]
```

### Set Environment Variables

Create `.env` file in project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Co-operative Bank API
BANK_API_BASE_URL=https://api.co-opbank.co.ke
BANK_CONSUMER_KEY=your-consumer-key-from-coop-bank
BANK_CONSUMER_SECRET=your-consumer-secret-from-coop-bank
BANK_ACCOUNT_NUMBER=your-account-number

# Callback URL (will be your deployed function URL)
CALLBACK_BASE_URL=https://your-project.supabase.co/functions/v1
```

### Deploy Edge Functions

```bash
# Deploy STK Push function
supabase functions deploy stk-push

# Deploy Payment Callback function
supabase functions deploy payment-callback

# Set secrets for production
supabase secrets set BANK_API_BASE_URL=https://api.co-opbank.co.ke
supabase secrets set BANK_CONSUMER_KEY=your-consumer-key
supabase secrets set BANK_CONSUMER_SECRET=your-consumer-secret
supabase secrets set CALLBACK_BASE_URL=https://your-project.supabase.co/functions/v1
```

### Test Functions Locally (Optional)

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve stk-push --env-file .env

# In another terminal, test the function
curl -X POST http://localhost:54321/functions/v1/stk-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "phoneNumber": "0712345678",
    "amount": 100,
    "orderId": "test-order-123"
  }'
```

---

## 🌐 Step 3: Frontend Integration

### Update Environment Variables

Add to your `.env` file (frontend):

```bash
# Already have these
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Keep existing vars
VITE_APP_NAME=ExpressWash
VITE_APP_VERSION=1.0.0
VITE_SESSION_TIMEOUT_MINUTES=30
VITE_USE_MOCK_DATA=false
```

### Update Vercel Environment Variables

If using Vercel:

```bash
# Via Vercel CLI
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Or via Vercel Dashboard:
# 1. Go to your project settings
# 2. Navigate to Environment Variables
# 3. Add variables for Production, Preview, and Development
```

### Install Dependencies

```bash
# Should already be installed, but verify:
npm install @supabase/supabase-js@2
npm install @tanstack/react-query
npm install zustand
npm install zod
```

---

## 🧪 Step 4: Testing

### Test in Sandbox Mode

Co-operative Bank provides sandbox credentials for testing:

1. **Get Sandbox Credentials**
   - Sign up at https://developer.co-opbank.co.ke/
   - Create a sandbox app
   - Get sandbox API credentials

2. **Update .env with Sandbox Credentials**
   ```bash
   BANK_API_BASE_URL=https://sandbox.co-opbank.co.ke
   BANK_CONSUMER_KEY=sandbox-consumer-key
   BANK_CONSUMER_SECRET=sandbox-consumer-secret
   ```

3. **Use Test Phone Numbers**
   ```
   254700000000 - Always succeeds immediately
   254700000001 - Always fails (insufficient funds)
   254700000002 - Always times out
   ```

4. **Test Payment Flow**
   - Create a test order
   - Go to checkout
   - Select M-Pesa payment
   - Enter test phone number: 254700000000
   - Click "Pay"
   - Should see success immediately

### Monitor Logs

```bash
# Watch Edge Function logs in real-time
supabase functions logs stk-push --tail

# In another terminal
supabase functions logs payment-callback --tail
```

### Verify Database

```sql
-- Check payment records
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;

-- Check payment stats
SELECT * FROM payment_stats;

-- Verify order updates
SELECT
  o.id,
  o.tracking_code,
  o.payment_status,
  p.status as payment_status,
  p.transaction_id
FROM orders o
LEFT JOIN payments p ON o.id = p.order_id
WHERE o.created_at > NOW() - INTERVAL '1 day'
ORDER BY o.created_at DESC;
```

---

## 🔒 Step 5: Security Configuration

### Enable RLS (Row Level Security)

Already configured in migration, but verify:

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'payments';

-- Should show: rowsecurity = true
```

### Secure API Keys

**Never commit these to git:**

```bash
# Verify .gitignore includes:
.env
.env.local
.env.production
*.env
supabase/.env
```

### IP Whitelist (Optional)

If Co-op Bank provides callback IP addresses:

```bash
# Add to Edge Function environment
supabase secrets set BANK_CALLBACK_IPS=41.90.x.x,197.248.x.x
```

### CORS Configuration

Already configured in Edge Functions, but verify:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

For production, restrict to your domain:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://expresswash.co.ke',
  // ...
};
```

---

## 📱 Step 6: Production Deployment

### Update to Production Credentials

1. **Get Production API Credentials**
   - Contact Co-operative Bank
   - Complete KYC and onboarding
   - Get production Consumer Key & Secret

2. **Update Supabase Secrets**
   ```bash
   supabase secrets set BANK_API_BASE_URL=https://api.co-opbank.co.ke
   supabase secrets set BANK_CONSUMER_KEY=prod-consumer-key
   supabase secrets set BANK_CONSUMER_SECRET=prod-consumer-secret
   ```

3. **Redeploy Functions**
   ```bash
   supabase functions deploy stk-push
   supabase functions deploy payment-callback
   ```

### Update Callback URL in Bank Dashboard

1. Log in to Co-op Bank Developer Portal
2. Go to your application settings
3. Set callback URL to:
   ```
   https://your-project.supabase.co/functions/v1/payment-callback
   ```

### Deploy Frontend

```bash
# Build production bundle
npm run build

# Deploy to Vercel
vercel --prod

# Or push to main branch (if auto-deploy configured)
git push origin main
```

---

## 🎨 Step 7: Customize UI (Optional)

### Update Payment Components

All components are in `src/components/payment/`:

- `PaymentModal.tsx` - STK Push status modal
- `PaymentMethodSelector.tsx` - Payment method selection
- `PaymentStatusBadge.tsx` - Status badges
- `CheckoutExample.tsx` - Complete checkout example

### Customize Branding

```typescript
// src/components/payment/PaymentModal.tsx

// Change colors
const successColor = 'green'; // Change to your brand color

// Update messages
const customerMessage = 'Thank you for choosing ExpressWash!';

// Add logo
<img src="/logo.png" alt="ExpressWash" className="w-16 h-16" />
```

### Add Notifications

Integrate SMS/Email in `payment-callback/index.ts`:

```typescript
// After successful payment
if (status === 'completed') {
  // Send SMS via Africa's Talking
  await sendSMS(customerPhone, `Payment received! Order #${trackingCode}`);

  // Send email
  await sendEmail(customerEmail, 'Payment Confirmation', emailTemplate);
}
```

---

## 📊 Step 8: Monitoring & Analytics

### Set Up Monitoring

1. **Supabase Dashboard**
   - Monitor function invocations
   - Check error rates
   - View logs

2. **Database Queries**
   ```sql
   -- Payment success rate (last 7 days)
   SELECT
     COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
   FROM payments
   WHERE created_at > NOW() - INTERVAL '7 days';

   -- Average payment time
   SELECT AVG(completed_at - created_at) as avg_payment_time
   FROM payments
   WHERE status = 'completed';

   -- Failed payment reasons
   SELECT failure_reason, COUNT(*)
   FROM payments
   WHERE status = 'failed'
   GROUP BY failure_reason
   ORDER BY COUNT(*) DESC;
   ```

3. **Set Up Alerts**
   - Success rate drops below 80%
   - Multiple payment failures
   - Callback delays

### Analytics Dashboard

Create admin view to track:
- Total revenue
- Payment success rate
- Popular payment methods
- Peak payment times
- Failed payment patterns

---

## 🐛 Troubleshooting

### Common Issues

**Issue 1: STK Push not received on phone**

```bash
# Check:
1. Phone number format (254XXXXXXXXX)
2. Phone has M-Pesa activated
3. Phone has network coverage
4. Bank API credentials are correct
5. Check Edge Function logs
```

**Issue 2: Callback not received**

```bash
# Check:
1. Callback URL is correct in bank dashboard
2. Edge Function is deployed
3. CORS headers configured
4. Check bank's callback logs (if available)
5. Verify payment record exists in database
```

**Issue 3: Token expired errors**

```bash
# Solution:
# Token caching implemented in Edge Function
# Should auto-refresh, but if issues persist:
supabase functions deploy stk-push --force
```

**Issue 4: Payment stuck in "processing"**

```bash
# Check payment status manually:
SELECT * FROM payments WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes';

# Query bank API:
# Use payment query endpoint to get current status
```

### Debug Mode

Enable detailed logging:

```typescript
// In Edge Functions
console.log('Debug: Request received', { phoneNumber, amount });
console.log('Debug: Token obtained', { expiresIn: tokenData.expires_in });
console.log('Debug: STK Push response', stkResponse);
```

View logs:
```bash
supabase functions logs stk-push --tail
```

---

## ✅ Checklist

Before going live, verify:

- [ ] Database migration completed
- [ ] Edge Functions deployed
- [ ] Production API credentials configured
- [ ] Callback URL registered with bank
- [ ] Environment variables set (frontend & backend)
- [ ] RLS policies enabled
- [ ] Tested with sandbox credentials
- [ ] Tested with real phone numbers
- [ ] Callback processing verified
- [ ] Order status updates working
- [ ] Error handling tested
- [ ] UI/UX polished
- [ ] Monitoring set up
- [ ] Security review completed

---

## 📞 Support

### Co-operative Bank Support
- **Developer Portal:** https://developer.co-opbank.co.ke/
- **Email:** apisupport@co-opbank.co.ke
- **Phone:** +254 711 049 000

### Supabase Support
- **Documentation:** https://supabase.com/docs
- **Discord:** https://discord.supabase.com
- **Email:** support@supabase.io

### ExpressWash Issues
- **GitHub:** https://github.com/newtvn/Expresswash-ke/issues

---

## 🎉 You're Done!

Your payment system is now live! Customers can:
- ✅ Pay instantly with M-Pesa STK Push
- ✅ Track payment status in real-time
- ✅ Receive automatic confirmations
- ✅ View payment history

**Next Steps:**
1. Monitor first transactions closely
2. Gather customer feedback
3. Optimize conversion rates
4. Add additional payment methods (QR Code, Cards)

Happy selling! 🚀
