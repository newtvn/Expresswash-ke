import { lazy } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BubbleBackground from './components/BubbleBackground';
import { LazyLoader } from '@/components/shared/LazyLoader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { SessionTimeoutWarning } from '@/components/SessionTimeout';
import { UserRole } from '@/types';

// Layouts
const PublicLayout = lazy(() => import('@/layouts/PublicLayout'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const CustomerLayout = lazy(() => import('@/layouts/CustomerLayout'));
const DriverLayout = lazy(() => import('@/layouts/DriverLayout'));
const WarehouseLayout = lazy(() => import('@/layouts/WarehouseLayout'));

// Public Pages
const Home = lazy(() => import('@/pages/public/Home'));
const ServicesDetail = lazy(() => import('@/pages/public/ServicesDetail'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const TrackOrder = lazy(() => import('@/pages/public/TrackOrder'));
const FAQ = lazy(() => import('@/pages/public/FAQ'));
const Contact = lazy(() => import('@/pages/public/Contact'));

// Auth Pages
const SignIn = lazy(() => import('@/pages/auth/SignIn'));
const SignUp = lazy(() => import('@/pages/auth/SignUp'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const OTPVerification = lazy(() => import('@/pages/auth/OTPVerification'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const OrderManagement = lazy(() => import('@/pages/admin/OrderManagement'));
const DriverManagement = lazy(() => import('@/pages/admin/DriverManagement'));
const BillingFinancials = lazy(() => import('@/pages/admin/BillingFinancials'));
const ProfitExpense = lazy(() => import('@/pages/admin/ProfitExpense'));
const MarketingCampaigns = lazy(() => import('@/pages/admin/MarketingCampaigns'));
const LoyaltyManagement = lazy(() => import('@/pages/admin/LoyaltyManagement'));
const ReviewsModeration = lazy(() => import('@/pages/admin/ReviewsModeration'));
const ReportsAnalytics = lazy(() => import('@/pages/admin/ReportsAnalytics'));
const Inventory = lazy(() => import('@/pages/admin/Inventory'));
const Communications = lazy(() => import('@/pages/admin/Communications'));
const SystemConfig = lazy(() => import('@/pages/admin/SystemConfig'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const SystemLogs = lazy(() => import('@/pages/admin/SystemLogs'));

// Customer Pages
const CustomerDashboard = lazy(() => import('@/pages/customer/Dashboard'));
const RequestPickup = lazy(() => import('@/pages/customer/RequestPickup'));
const OrderHistory = lazy(() => import('@/pages/customer/OrderHistory'));
const OrderDetails = lazy(() => import('@/pages/customer/OrderDetails'));
const FavoriteItems = lazy(() => import('@/pages/customer/FavoriteItems'));
const Addresses = lazy(() => import('@/pages/customer/Addresses'));
const CustomerInvoices = lazy(() => import('@/pages/customer/Invoices'));
const PaymentHistory = lazy(() => import('@/pages/customer/PaymentHistory'));
const LoyaltyRewards = lazy(() => import('@/pages/customer/LoyaltyRewards'));
const Referrals = lazy(() => import('@/pages/customer/Referrals'));
const CustomerReviews = lazy(() => import('@/pages/customer/Reviews'));
const Profile = lazy(() => import('@/pages/customer/Profile'));
const Notifications = lazy(() => import('@/pages/customer/Notifications'));

// Driver Pages
const DriverDashboard = lazy(() => import('@/pages/driver/Dashboard'));
const RouteView = lazy(() => import('@/pages/driver/RouteView'));
const PickupDelivery = lazy(() => import('@/pages/driver/PickupDelivery'));
const CashCollection = lazy(() => import('@/pages/driver/CashCollection'));

// Warehouse Pages
const ItemIntake = lazy(() => import('@/pages/warehouse/ItemIntake'));
const Processing = lazy(() => import('@/pages/warehouse/Processing'));
const QualityControl = lazy(() => import('@/pages/warehouse/QualityControl'));
const DispatchQueue = lazy(() => import('@/pages/warehouse/DispatchQueue'));

// 404
const NotFound = lazy(() => import('@/pages/NotFound'));

// Query client with caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BubbleBackground />
      <Sonner />
      <SessionTimeoutWarning />
      <ErrorBoundary>
        <BrowserRouter>
          <LazyLoader>
            <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<ServicesDetail />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/track" element={<TrackOrder />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
            </Route>

            {/* Auth Routes (no layout wrapper - standalone pages) */}
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/signup" element={<SignUp />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/verify-otp" element={<OTPVerification />} />

            {/* Legacy auth redirects */}
            <Route path="/signin" element={<Navigate to="/auth/signin" replace />} />
            <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />

            {/* Admin Portal */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="drivers" element={<DriverManagement />} />
              <Route path="billing" element={<BillingFinancials />} />
              <Route path="profit-expense" element={<ProfitExpense />} />
              <Route path="marketing" element={<MarketingCampaigns />} />
              <Route path="loyalty" element={<LoyaltyManagement />} />
              <Route path="reviews" element={<ReviewsModeration />} />
              <Route path="reports" element={<ReportsAnalytics />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="communications" element={<Communications />} />
              <Route path="system-config" element={<SystemConfig />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="system-logs" element={<SystemLogs />} />
            </Route>

            {/* Customer Portal */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={[UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                  <CustomerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/portal/dashboard" replace />} />
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="request-pickup" element={<RequestPickup />} />
              <Route path="orders" element={<OrderHistory />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="favorites" element={<FavoriteItems />} />
              <Route path="addresses" element={<Addresses />} />
              <Route path="invoices" element={<CustomerInvoices />} />
              <Route path="payments" element={<PaymentHistory />} />
              <Route path="loyalty" element={<LoyaltyRewards />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="reviews" element={<CustomerReviews />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>

            {/* Driver Portal */}
            <Route
              path="/driver"
              element={
                <ProtectedRoute allowedRoles={[UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                  <DriverLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/driver/dashboard" replace />} />
              <Route path="dashboard" element={<DriverDashboard />} />
              <Route path="route" element={<RouteView />} />
              <Route path="pickup-delivery" element={<PickupDelivery />} />
              <Route path="orders" element={<PickupDelivery />} />
              <Route path="cash" element={<CashCollection />} />
            </Route>

            {/* Warehouse Portal */}
            <Route
              path="/warehouse"
              element={
                <ProtectedRoute allowedRoles={[UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                  <WarehouseLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ItemIntake />} />
              <Route path="intake" element={<ItemIntake />} />
              <Route path="processing" element={<Processing />} />
              <Route path="quality-control" element={<QualityControl />} />
              <Route path="quality" element={<QualityControl />} />
              <Route path="dispatch" element={<DispatchQueue />} />
            </Route>

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </LazyLoader>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
