# ExpressWash - Live UI Testing Guide

> Full end-to-end walkthrough of the system through the browser UI.
> Use this guide to test every role and feature in the correct order.

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Customer** | `ngethenan768+user@gmail.com` | `TestExpressWash2026!` |
| **Driver** | `ngethenan768+driver@gmail.com` | `TestExpressWash2026!` |
| **Admin** | `ngethenan768@gmail.com` | `TestExpressWash2026!` |

> **Tip:** Use separate browser profiles or incognito windows to stay logged into multiple accounts at once.

---

## Prerequisites

1. Dev server running: `npm run dev` (opens at `http://localhost:5173`)
2. Supabase project is live with migrations applied
3. Test accounts above have been created and are active

---

## Phase 1: Landing Page & Public Pages

**URL:** `http://localhost:5173/`

### What to check:
- [ ] Landing page loads with the new ExpressWash logo (blue circle with sparkle pattern)
- [ ] Header shows: Logo + "ExpressWash" text, nav links (Services, How It Works, Pricing, Track Order), Sign In / Get Started buttons
- [ ] Scroll down — verify the Services, Process, Pricing sections render correctly
- [ ] Footer shows the new logo and contact info
- [ ] Click **"Track Order"** in the nav — should go to `/track`
- [ ] Try tracking a known code (e.g. `EW-2024-00123`) — should show order status
- [ ] Try a fake code — should show "not found"

---

## Phase 2: Customer Flow

### 2.1 — Sign In as Customer

1. Click **"Sign In"** or go to `/auth/signin`
2. **You should see:** Auth page with the new ExpressWash logo, "Welcome back" title
3. Enter: `ngethenan768+user@gmail.com` / `TestExpressWash2026!`
4. Click Sign In
5. **You should see:** Redirect to `/portal/dashboard`

### 2.2 — Customer Dashboard

**URL:** `/portal/dashboard`

- [ ] Sidebar shows: new ExpressWash logo, "My Account" subtitle
- [ ] Dashboard shows overview cards (active orders, total spent, loyalty points, etc.)
- [ ] Sidebar navigation groups: Overview, Orders, Billing, Rewards, Account

### 2.3 — Place a New Order

1. Click **"Request Pickup"** in the sidebar
2. **URL:** `/portal/request-pickup`
3. **You should see:** Order form with item selection

**Steps:**
- [ ] Select item type: **Carpet**
- [ ] Enter dimensions: Length = `120`, Width = `80` (in inches)
- [ ] Observe real-time price calculation (base price + delivery fee + 16% VAT)
- [ ] Select zone: **Kitengela** (should show same-day/next-day delivery)
- [ ] Select a pickup date
- [ ] (Optional) Enter a promo code if one exists
- [ ] Review the quote summary
- [ ] Click **Submit Order**
- [ ] **You should see:** Success confirmation with a tracking code (e.g. `EW-2026-XXXXX`)
- [ ] **Write down the tracking code** — you'll need it in later phases

### 2.4 — View Order History

1. Click **"My Orders"** in the sidebar
2. **URL:** `/portal/orders`
3. **You should see:** Table/list of orders including the one just placed
4. Click into the new order
5. **You should see:** Order details page with:
   - Status badge showing `PENDING`
   - Item details with dimensions and pricing
   - 12-stage visual progress tracker (first step highlighted)
   - Tracking code

### 2.5 — Invoices & Payments

1. Click **"Invoices"** in the sidebar → see list of invoices
2. Click **"Payments"** → see payment history
3. **You should see:** Any invoices generated for your orders

### 2.6 — Loyalty & Rewards

1. Click **"Loyalty & Rewards"** in the sidebar
2. **URL:** `/portal/loyalty`
3. **You should see:** Current tier (Bronze/Silver/Gold/Platinum), points balance, rewards catalog
4. Check the available rewards (10% off, free delivery, etc.)

### 2.7 — Referrals

1. Click **"Referrals"** in the sidebar
2. **You should see:** Referral code/link and any existing referrals

### 2.8 — Submit a Review

1. Click **"Reviews"** in the sidebar
2. Submit a review for a completed order (if any exist)
3. **You should see:** Review submitted with "pending moderation" status

### 2.9 — Profile & Notifications

1. Click **"Profile"** → verify your account details, update if needed
2. Click **"Notifications"** → check notification preferences (SMS/email toggles)
3. Click **"Addresses"** → manage delivery addresses

### 2.10 — Order Cancellation

1. Go back to **"My Orders"**
2. Open the newly placed order (if still `PENDING`)
3. Click **Cancel Order**
4. **You should see:** Order status changes to `CANCELLED`, cancellation notification queued

> **Now log out** (dropdown in sidebar footer → Logout)

---

## Phase 3: Admin Flow

### 3.1 — Sign In as Admin

1. Go to `/auth/signin`
2. Enter: `ngethenan768@gmail.com` / `TestExpressWash2026!`
3. **You should see:** Redirect to `/admin/dashboard`

### 3.2 — Admin Dashboard

**URL:** `/admin/dashboard`

- [ ] Sidebar shows: new ExpressWash logo, "Admin Portal" subtitle
- [ ] Dashboard shows KPI cards: total revenue, total orders, delivery rate, customer retention
- [ ] Charts and graphs for recent activity

### 3.3 — Order Management

1. Click **"Orders"** in the sidebar
2. **URL:** `/admin/orders`
3. **You should see:** All orders across all customers (not just your own)

**Test the order lifecycle — pick a PENDING order:**
- [ ] Click into a pending order
- [ ] Change status to **CONFIRMED** → save
- [ ] Assign a driver → change status to **DRIVER_ASSIGNED**
- [ ] **You should see:** Status updates reflected, status history logged

### 3.4 — User Management

1. Click **"Users"** in the sidebar
2. **URL:** `/admin/users`
3. **You should see:** All users listed
4. Filter by role (Customer, Driver, Warehouse Staff, Admin)
5. Search for a specific user by name/email
6. Click a user to view/edit their profile

### 3.5 — Driver Management

1. Click **"Drivers"** in the sidebar
2. **You should see:** Driver roster with ratings, vehicle info, status (available/offline/on_route)

### 3.6 — Billing & Finance

1. Click **"Billing"** → view/create invoices
2. Click **"Profit & Expense"**:
   - [ ] Create a new expense (e.g. Fuel, KES 5000)
   - [ ] Approve the expense
   - [ ] Verify it appears in the expense list

### 3.7 — Marketing & Promotions

1. Click **"Campaigns"** → view/create marketing campaigns
2. Click **"Promotions"**:
   - [ ] Create a new promo code (e.g. `TEST20` for 20% off)
   - [ ] Set validity dates and usage limits
   - [ ] Save — verify it appears in the list
3. Click **"Loyalty"** → manage loyalty program rules and rewards catalog
4. Click **"Reviews"**:
   - [ ] See pending customer reviews
   - [ ] Approve or reject a review
   - [ ] **You should see:** Review status changes to approved/rejected

### 3.8 — Reports & Analytics

1. Click **"Reports"** in the sidebar
2. **You should see:** Analytics dashboards with:
   - Sales charts
   - Zone performance breakdown
   - Driver performance rankings
   - Revenue by item type

### 3.9 — System Configuration

1. Click **"Pricing"** → view/edit service prices per item type and delivery fees per zone
2. Click **"Holiday Calendar"**:
   - [ ] View existing holidays
   - [ ] Click "Add Kenyan Holidays" to auto-populate
   - [ ] Add a custom holiday
3. Click **"Configuration"** → system settings and business rules
4. Click **"Audit Logs"** → verify actions from your session are logged (order updates, expense approvals, review moderation)
5. Click **"System Logs"** → check for any errors/warnings

### 3.10 — Warehouse Stats

1. Click **"Inventory"** in the sidebar
2. **You should see:** Warehouse statistics (total items, in washing, drying, quality check, ready to dispatch)

### 3.11 — Communications

1. Click **"Messages"** in the sidebar
2. **You should see:** Interface to send SMS/email to customers

### 3.12 — Prepare an Order for Driver Testing

Before switching to Driver, set up an order for the driver to work with:
1. Go to **Orders** → find or create a new `PENDING` order
2. Change status to `CONFIRMED`
3. Assign the test driver (`ngethenan768+driver@gmail.com`)
4. Change status to `DRIVER_ASSIGNED`
5. **Note the order ID/tracking code**

> **Now log out**

---

## Phase 4: Driver Flow

### 4.1 — Sign In as Driver

1. Go to `/auth/signin`
2. Enter: `ngethenan768+driver@gmail.com` / `TestExpressWash2026!`
3. **You should see:** Redirect to `/driver/dashboard`

### 4.2 — Driver Dashboard

**URL:** `/driver/dashboard`

- [ ] Header shows: new ExpressWash logo, driver name, logout button
- [ ] Dashboard shows: today's tasks, earnings, current rating
- [ ] Status toggle (Available / Offline / On Route)

**Test status toggle:**
- [ ] Switch to **Available** → verify status updates
- [ ] Switch to **On Route** → verify
- [ ] Switch to **Offline** → verify
- [ ] Set back to **Available**

### 4.3 — Pickup Flow

1. Go to **"Pickup & Delivery"** page
2. **URL:** `/driver/pickup-delivery`
3. **You should see:** Assigned pickup/delivery tasks including the order prepared in Phase 3

**For the assigned order, walk through the pickup:**
- [ ] View customer details (name, address, phone)
- [ ] Confirm pickup schedule → status moves to `PICKUP_SCHEDULED`
- [ ] Mark as picked up → status moves to `PICKED_UP`
- [ ] Enter item measurements if prompted (length x width)

### 4.4 — Route View

1. Click **"My Route"** in the nav
2. **URL:** `/driver/route`
3. **You should see:** Map view with assigned deliveries/pickups (requires Google Maps API key)

### 4.5 — Cash Collection

1. Click **"Cash Collection"** 
2. **URL:** `/driver/cash`
3. **You should see:** Cash collection tracking interface
4. Record a cash payment if applicable

> **Now log out**

---

## Phase 5: Warehouse Flow

> **Note:** You'll need a warehouse_staff account. If one doesn't exist, use the Admin to create one or update an existing user's role to `warehouse_staff`.

### 5.1 — Sign In as Warehouse Staff

1. Go to `/auth/signin`
2. Sign in with a warehouse_staff account
3. **You should see:** Redirect to `/warehouse/intake`

### 5.2 — Item Intake

**URL:** `/warehouse/intake`

1. **You should see:** Incoming items queue
2. For the order picked up in Phase 4:
   - [ ] Log the items with condition notes (e.g. "Minor stains on corner")
   - [ ] Confirm intake → status moves to `IN_PROCESSING`

### 5.3 — Processing

**URL:** `/warehouse/processing`

1. **You should see:** Items currently being processed
2. Move items through stages:
   - [ ] **Washing** stage → mark complete
   - [ ] **Drying** stage → mark complete
   - [ ] Status moves to `PROCESSING_COMPLETE`

### 5.4 — Quality Control

**URL:** `/warehouse/quality-control`

1. **You should see:** Items pending QC inspection
2. For the processed item:
   - [ ] Inspect and select **Pass** or **Fail**
   - [ ] Add QC notes if needed
   - [ ] If passed → status moves to `QUALITY_APPROVED`
   - [ ] If failed → item goes back to processing

### 5.5 — Dispatch

**URL:** `/warehouse/dispatch`

1. **You should see:** Items ready for delivery
2. For the QC-approved item:
   - [ ] Assign a driver for delivery
   - [ ] Mark as staged → status moves to `READY_FOR_DELIVERY`

> **Now log out**

---

## Phase 6: Delivery Completion (Driver)

### 6.1 — Sign Back In as Driver

1. Sign in as driver: `ngethenan768+driver@gmail.com` / `TestExpressWash2026!`
2. Go to **Pickup & Delivery**

### 6.2 — Complete Delivery

1. Find the order that's `READY_FOR_DELIVERY`
2. Mark as **Out for Delivery** → status moves to `OUT_FOR_DELIVERY`
3. Mark as **Delivered** → status moves to `DELIVERED`
4. **You should see:**
   - [ ] Order status is `DELIVERED`
   - [ ] Loyalty points awarded to the customer
   - [ ] Driver stats updated (completed deliveries count)

> **Now log out**

---

## Phase 7: Post-Delivery Verification (Customer)

### 7.1 — Sign Back In as Customer

1. Sign in as: `ngethenan768+user@gmail.com` / `TestExpressWash2026!`

### 7.2 — Verify Completed Order

1. Go to **My Orders** → find the delivered order
2. **You should see:**
   - [ ] Status shows `DELIVERED`
   - [ ] All 12 stages completed in the visual tracker
3. Go to **Loyalty & Rewards**
   - [ ] Verify loyalty points were credited for this order
4. Go to **Reviews**
   - [ ] Submit a review for the delivered order (star rating + comment)
   - [ ] Review shows as "pending moderation"

---

## Phase 8: Admin Final Verification

### 8.1 — Sign Back In as Admin

1. Sign in as: `ngethenan768@gmail.com` / `TestExpressWash2026!`

### 8.2 — Verify End-to-End

1. **Orders** → confirm the test order shows as `DELIVERED`
2. **Reviews** → find and approve the customer's review
3. **Audit Logs** → verify the full chain of events is logged:
   - [ ] Order created
   - [ ] Status transitions (PENDING → CONFIRMED → DRIVER_ASSIGNED → ... → DELIVERED)
   - [ ] Payment recorded
   - [ ] Loyalty points awarded
   - [ ] Review submitted and moderated
4. **Reports** → verify the order contributes to:
   - [ ] Revenue totals
   - [ ] Zone performance stats
   - [ ] Driver performance metrics

---

## Phase 9: Payment Testing

### 9.1 — M-Pesa STK Push (Customer)

1. Sign in as customer
2. Place a new order or find an unpaid order
3. Click **Pay with M-Pesa**
4. Enter a valid phone number (format: `254XXXXXXXXX`)
5. **You should see:** STK push prompt on the phone
6. Complete payment on phone
7. **Verify:** Payment status updates to `PAID`, invoice marked as paid

### 9.2 — Payment Edge Cases

- [ ] Try an invalid phone number → should show validation error
- [ ] Try amount less than KES 10 → should be rejected

---

## Phase 10: Notification Verification

Throughout the above phases, check:

- [ ] **In-app notifications:** Bell icon shows unread count, click to see notification list
- [ ] **Email notifications:** Check inbox for `ngethenan768+user@gmail.com` for order status emails
- [ ] **Mark as read:** Click a notification to mark it read, verify unread count decreases

---

## Quick Reference: Complete Order Status Flow

```
PENDING → CONFIRMED → DRIVER_ASSIGNED → PICKUP_SCHEDULED → PICKED_UP
    → IN_PROCESSING → PROCESSING_COMPLETE → QUALITY_CHECK → QUALITY_APPROVED
    → READY_FOR_DELIVERY → OUT_FOR_DELIVERY → DELIVERED
```

**Alternative paths:**
- `PENDING → CANCELLED` (customer cancels before pickup)
- `DELIVERED → REFUNDED` (admin issues refund)

---

## Known Issues (from API testing)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 4 | `get_dashboard_kpis` RPC returns "admin access required" with service role key | Medium | Open |
| 5 | No pricing entry in `system_config` — admin pricing UI updates don't persist | Medium | Open |

---

## Tips

- **Parallel testing:** Open 3 browser profiles (Chrome default, Incognito, Firefox) to stay logged into Customer, Admin, and Driver simultaneously
- **Order of testing:** Follow phases 1-8 in sequence — each phase depends on the previous one
- **If something fails:** Check browser console (F12) for errors and the Supabase logs dashboard
