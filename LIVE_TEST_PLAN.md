# ExpressWash Live Testing Plan

**Date:** 2026-04-04
**Accounts:** Customer (+user), Driver (+driver), Admin (ngethenan768@gmail.com)
**M-Pesa Test Phone:** 0706446072

---

## Phase 1: Authentication & Profile (All Roles)

### 1.1 Customer Auth
- [ ] Sign in with email/password → verify profile returned (name, role=customer, zone, loyalty)
- [ ] Update last_login_at → verify timestamp written
- [ ] Wrong password → verify rejection message
- [ ] Update profile (name, phone) → verify persisted
- [ ] Upsert notification preferences → verify all 6 toggles saved
- [ ] Read notification preferences back → verify values match

### 1.2 Driver Auth
- [ ] Sign in → verify profile (role=driver) + drivers table record (vehicle, plate, license)
- [ ] Toggle status: available → on_route → on_break → offline → available
- [ ] Verify is_online flips correctly with each status change

### 1.3 Admin Auth
- [ ] Sign in → verify profile (role=admin)
- [ ] Verify can read ALL profiles (not just own) — RLS check
- [ ] Verify can read ALL orders across customers — RLS check

### 1.4 RLS Isolation
- [ ] Customer CANNOT read other users' profiles
- [ ] Customer CANNOT update another user's profile
- [ ] Driver CANNOT read orders not assigned to them

---

## Phase 2: Customer Order Journey

### 2.1 Browse & Price
- [ ] Fetch active zones → verify all zones with delivery fees
- [ ] calculateItemPrice() for each item type (carpet, rug, sofa, curtain, mattress, chair, pillow)
- [ ] Verify client-side pricing matches server RPC `calculate_order_pricing`
- [ ] Fetch holidays → verify they affect ETA calculation

### 2.2 Create Order
- [ ] Generate unique tracking code (EW-YYYY-NNNNN)
- [ ] Insert order with status=1 (Pending) → verify created
- [ ] Insert 3-4 realistic order items with dimensions → verify saved
- [ ] Call `increment_customer_orders` RPC → verify profile.total_orders incremented
- [ ] Read order back by tracking code → verify all fields match
- [ ] **TRIGGER CHECK:** `log_order_status_change` → verify order_status_history row created (null→1)

### 2.3 Promo Code (if applicable)
- [ ] Create a test promotion (admin)
- [ ] Validate promo code → verify discount calculated
- [ ] Apply to order via `calculate_order_pricing` with promo → verify discount applied
- [ ] Record promotion usage → verify times_used incremented

### 2.4 STK Push Payment
- [ ] Call `stk-push` edge function (10 KES, phone 0706446072)
- [ ] Verify payment record created (status=processing, checkout_request_id populated)
- [ ] **USER CONFIRMS:** M-Pesa prompt received on phone, enters PIN
- [ ] **USER CONFIRMS:** M-Pesa SMS received confirming deduction
- [ ] Check payment record → verify status updated (processing → completed)
- [ ] Check mpesa_receipt_number populated
- [ ] **TRIGGER CHECK:** `trigger_update_order_on_payment` → order auto-confirms (status 1→2)
- [ ] **TRIGGER CHECK:** `trg_notify_on_payment` → notification_history rows created (SMS + email)
- [ ] **TRIGGER CHECK:** `trg_log_payment_status_change` → payment_status_events row created
- [ ] **TRIGGER CHECK:** `queue_notification_on_status` → "Order Confirmation" SMS/email queued (status 2)

### 2.5 Payment Verification
- [ ] Call `verifyPayment(orderId)` → verify returns verified=true
- [ ] Call `getPaymentByOrderId` → verify payment record complete
- [ ] Call `getPaymentByCheckoutRequestId` → verify same record found

### 2.6 Order Tracking
- [ ] `trackOrder(trackingCode)` → verify returns order with items
- [ ] Customer can see order in `getCustomerOrders` list
- [ ] Customer can filter by status
- [ ] Customer can search by tracking code

### 2.7 Order Cancellation (separate test order)
- [ ] Create a second order (status=1)
- [ ] Cancel it → verify status=13
- [ ] **TRIGGER CHECK:** `log_order_status_change` → history row (1→13)
- [ ] **TRIGGER CHECK:** `queue_notification_on_status` → "Order Cancelled" SMS/email queued
- [ ] Attempt cancel on status≥6 → verify rejected by status validation trigger
- [ ] Verify cancelled order shows in customer's order list with correct status

### 2.8 Invoices & Payments View
- [ ] `getInvoices({customerId})` → verify returns customer's invoices only
- [ ] `getPayments()` → verify returns customer's payments
- [ ] Verify RLS: customer cannot see other customers' invoices

### 2.9 Loyalty System
- [ ] `getLoyaltyAccount(customerId)` → verify account exists (or null)
- [ ] `getLoyaltyTransactions(customerId)` → verify history
- [ ] `getRewards()` → verify available rewards
- [ ] (After delivery) verify points awarded by trigger

### 2.10 Referrals
- [ ] `createReferral(customerId, 'friend@example.com')` → verify referral created
- [ ] Verify referral code format
- [ ] `getReferrals(customerId)` → verify listed
- [ ] Duplicate referral → verify rejected

### 2.11 Reviews
- [ ] (After delivery) `getDeliveredOrdersWithoutReview` → verify order listed
- [ ] `submitReview({orderId, rating: 4, comment})` → verify created with status=pending
- [ ] `getMyReviews(customerId)` → verify listed

---

## Phase 3: Admin Operations

### 3.1 Order Management
- [ ] `getOrders()` → verify paginated, all customers visible
- [ ] Filter by status, zone, search
- [ ] `getOrderStats()` → verify counts by status
- [ ] `assignDriverToOrder(orderId, driverId, ...)` → verify driver fields set + status=2
- [ ] `bulkUpdateOrderStatus([ids], newStatus)` → verify all updated
- [ ] **TRIGGER CHECK:** Each status change logged in order_status_history

### 3.2 Driver Assignment & Route Creation
- [ ] Assign driver to order → verify order.driver_id, driver_name, driver_phone
- [ ] Create driver_route for today → verify saved
- [ ] Create route_stop (pickup) → verify linked to route and order
- [ ] Create route_stop (delivery) → verify linked

### 3.3 User Management
- [ ] `getUsers({role, zone, search})` → verify pagination + filters
- [ ] `updateUser(userId, {phone, zone})` → verify updated
- [ ] `toggleUserActive(userId)` → verify is_active flipped
- [ ] (Toggle back to active)

### 3.4 Promotions
- [ ] `createPromotion({code, discount, dates, limits})` → verify created
- [ ] `getAllPromotions()` → verify listed
- [ ] `togglePromotionActive(id, false)` → verify deactivated
- [ ] `togglePromotionActive(id, true)` → verify reactivated
- [ ] `getPromotionUsage(promotionId)` → verify usage records

### 3.5 Invoicing
- [ ] `createInvoice({orderId, items, totals})` → verify created with invoice_number
- [ ] `getInvoiceById(id)` → verify items included
- [ ] `updateInvoiceStatus(id, 'paid')` → verify paid_at set
- [ ] **TRIGGER CHECK:** `trg_log_invoice_status_change` → invoice_status_events row
- [ ] `recordPayment({invoiceId, amount, method: 'cash'})` → verify payment created

### 3.6 Expenses
- [ ] `createExpense({category: 'fuel', amount, ...})` → verify status=pending
- [ ] `getExpenses({category, status})` → verify filters work
- [ ] `approveExpense(id, adminId)` → verify status=approved, approved_by set
- [ ] `rejectExpense(id)` → verify status=rejected
- [ ] `getExpenseSummary()` → verify category breakdown
- [ ] `getExpenseKPIs()` → verify revenue, expenses, profit, margin
- [ ] **TRIGGER CHECK:** `audit_expenses` → audit_logs rows created

### 3.7 Reviews Moderation
- [ ] `getAllReviews()` → verify includes pending review from customer
- [ ] `getReviewStats()` → verify averageRating, counts
- [ ] `moderateReview(id, 'approved', 'Thank you!')` → verify status + admin_response
- [ ] `getPublicReviews()` → verify approved review visible
- [ ] **TRIGGER CHECK:** `audit_reviews` → audit_logs row

### 3.8 Zones
- [ ] `getAllZones()` → verify all zones (active + inactive)
- [ ] `createZone({name, fee, policy})` → verify created
- [ ] `updateZone(id, {fee})` → verify updated
- [ ] `toggleZoneActive(id, false)` → verify deactivated
- [ ] Clean up test zone
- [ ] **TRIGGER CHECK:** `audit_zones` → audit_logs rows

### 3.9 Pricing
- [ ] `getPricingConfig()` → verify pricePerSqInch, deliveryFees, vatRate, minimumOrder
- [ ] (Optional) `updatePricingConfig(config, adminId)` → verify saved + audit logged
- [ ] `getPricingHistory()` → verify change history from audit_logs

### 3.10 Holidays
- [ ] `getHolidays()` → verify list
- [ ] `addHoliday('Test Holiday', date, false, adminId)` → verify created
- [ ] `isHoliday(date)` → verify returns true
- [ ] `deleteHoliday(id)` → verify deleted

### 3.11 Reports (RPC Functions)
- [ ] `getDashboardKPIs()` → verify returns totalRevenue, ordersToday, etc.
- [ ] `getOrderStatusCounts()` → verify status breakdown
- [ ] `getSalesData(30)` → verify returns date/orders/revenue array
- [ ] `getRevenueReport(start, end, 'day')` → verify by_period, by_payment_method, by_zone
- [ ] `getOrderReport(start, end)` → verify totals, status_breakdown, sla_compliance
- [ ] `getDriverPerformanceReport(start, end)` → verify per-driver metrics
- [ ] `getCustomerReport(start, end)` → verify customer stats
- [ ] `getFinancialReport(start, end)` → verify profit/loss

### 3.12 Audit & System Logs
- [ ] `getAuditLogs({entity, action})` → verify query works with filters
- [ ] `getSystemLogs()` → verify query works

### 3.13 Warehouse
- [ ] `getWarehouseStats()` → verify stats structure
- [ ] `getProcessingItems()` → verify query works
- [ ] `getIntakeQueue()` → verify query works
- [ ] `getDispatchQueue()` → verify query works

---

## Phase 4: Driver Pickup & Delivery Flow

### 4.1 Route & Stop Management
- [ ] `getDriverRoutes(driverId, today)` → verify route with stops
- [ ] Verify stops have correct type (pickup/delivery), address, order linkage

### 4.2 Pickup Flow
- [ ] `getOrderByUUID(orderId)` → verify order items for measurement
- [ ] `updateOrderItems(orderId, measuredItems, newSubtotal, newTotal)` → verify:
  - Old items deleted
  - New items inserted with actual measurements
  - Order subtotal + total updated
- [ ] `completeRouteStop(stopId)` → verify status=completed, completed_time set
- [ ] Progress status 2→3→4→5 (respecting validation trigger)
- [ ] **TRIGGER CHECK:** `log_order_status_change` → history rows for each transition
- [ ] **TRIGGER CHECK:** `queue_notification_on_status` → "Pickup Reminder" at status 4

### 4.3 Warehouse Processing (Admin)
- [ ] Progress status 5→6→7→8→9→10
- [ ] **TRIGGER CHECK:** `queue_notification_on_status` → "Order Ready for Delivery" at status 10

### 4.4 Delivery Flow
- [ ] Create delivery route_stop
- [ ] Progress status 10→11
- [ ] Progress status 11→12 (DELIVERED)
- [ ] `completeRouteStop(deliveryStopId)` → verify completed
- [ ] **TRIGGER CHECK:** `award_loyalty_on_delivery` → loyalty_accounts.points increased
- [ ] **TRIGGER CHECK:** `update_profile_stats_on_delivery` → profiles.total_orders + total_spent
- [ ] **TRIGGER CHECK:** `queue_notification_on_status` → "Delivery Confirmation" SMS/email queued
- [ ] **BUG TO VERIFY:** loyalty_tier trigger type mismatch (42804)

### 4.5 Cash Payment Recording
- [ ] `recordPayment({orderId, amount, method: 'cash', recordedBy: driverId})` → verify created
- [ ] Verify payment.recorded_by = driverId
- [ ] **TRIGGER CHECK:** `trg_notify_on_payment` → SMS/email queued

---

## Phase 5: Notification Verification

### 5.1 Notification Queue (notification_history)
- [ ] After order status 2 → verify "Order Confirmation" SMS + email rows (status=pending)
- [ ] After order status 4 → verify "Pickup Reminder" rows
- [ ] After order status 10 → verify "Order Ready for Delivery" rows
- [ ] After order status 12 → verify "Delivery Confirmation" rows
- [ ] After order status 13 → verify "Order Cancelled" rows
- [ ] After payment completed → verify "Payment Confirmation" rows

### 5.2 Notification Templates
- [ ] Verify all required templates exist in notification_templates:
  - Order Confirmation (SMS + email)
  - Pickup Reminder (SMS + email)
  - Order Ready for Delivery (SMS + email)
  - Delivery Confirmation (SMS + email)
  - Order Cancelled (SMS + email)
  - Payment Confirmation (SMS + email)

### 5.3 In-App Notifications
- [ ] `createNotification(userId, type, variables)` → verify stored
- [ ] `getUserNotifications(userId)` → verify returned
- [ ] `markNotificationAsRead(id)` → verify read=true
- [ ] `markAllAsRead(userId)` → verify all marked
- [ ] `getUnreadCount(userId)` → verify count accurate

### 5.4 send-notification Edge Function
- [ ] Call `send-notification` → verify it processes pending notification_history rows
- [ ] Verify SMS sent via Africa's Talking (check phone for SMS)
- [ ] Verify notification_history.status updated to 'sent' or 'failed'

### 5.5 Push Notifications
- [ ] (Browser only — skip in CLI test) Register/unregister push subscription

---

## Phase 6: Edge Functions

### 6.1 stk-push
- [ ] Valid request → STK prompt received on phone
- [ ] Invalid phone → error returned
- [ ] Amount < 10 → "Minimum payment amount" error
- [ ] Duplicate payment (already completed) → "Order already paid" error
- [ ] Invalid order ID → "Order not found" error

### 6.2 payment-callback
- [ ] Verify callback URL is reachable
- [ ] Simulate callback → verify payment updated to completed
- [ ] Verify idempotency (same callback twice → no duplicate processing)

### 6.3 generate-pdf
- [ ] Generate invoice PDF → verify uploaded to storage + pdf_url set
- [ ] Generate receipt PDF → verify uploaded to storage + receipt_url set

### 6.4 send-notification
- [ ] Process pending queue → verify SMS/email delivery
- [ ] Failed notification → verify retry_count incremented
- [ ] After 3 retries → verify status=failed

---

## Phase 7: Trigger & Side-Effect Verification

### 7.1 Order Status Validation
- [ ] Valid transition (1→2) → succeeds
- [ ] Invalid transition (1→5) → raises P0001 exception
- [ ] Terminal state (13→anything) → raises exception
- [ ] Verify SLA deadline set on 1→2

### 7.2 Loyalty Points (status 12)
- [ ] Points awarded = FLOOR(order.total / 100)
- [ ] loyalty_transactions row created (type=earned)
- [ ] loyalty_accounts.points incremented
- [ ] profiles.loyalty_points updated
- [ ] Tier recalculated (bronze/silver/gold/platinum thresholds)

### 7.3 Profile Stats (status 12)
- [ ] profiles.total_orders incremented
- [ ] profiles.total_spent increased by order.total

### 7.4 Payment → Order Auto-Confirm
- [ ] Payment completed on status=1 order → order auto-confirms to status=2

---

## Known Bugs to Verify

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | Payment callback not firing | stk-push CALLBACK_BASE_URL env var | CONFIRMED |
| 2 | loyalty_tier type mismatch on delivery | award_loyalty_points_on_delivery trigger | CONFIRMED |
| 3 | (TBD during testing) | | |

---

## Test Data Cleanup

After all tests complete:
- Delete test orders (cascade: order_items, payments, reviews, order_status_history)
- Delete test route_stops and driver_routes
- Delete test invoices + invoice_items
- Delete test expenses
- Delete test promotions
- Delete test referrals
- Delete test notification_history rows
- Delete test notification_preferences
- Delete test holidays
