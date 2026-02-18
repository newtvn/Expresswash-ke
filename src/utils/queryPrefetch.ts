/**
 * Query Prefetching Strategies - Uber-level predictive loading
 * Prefetch data before user needs it for instant perceived performance
 */

import { QueryClient } from '@tanstack/react-query';
import { getOrders, getOrderById } from '@/services/orderService';
import { getDashboardKPIs, getSalesData } from '@/services/reportService';

/**
 * Prefetch dashboard data on hover/focus
 * Use on navigation links to dashboard
 */
export const prefetchDashboard = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['admin', 'dashboard', 'kpis'],
      queryFn: getDashboardKPIs,
      staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    }),
    queryClient.prefetchQuery({
      queryKey: ['admin', 'dashboard', 'sales'],
      queryFn: () => getSalesData(30),
      staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    }),
  ]);
};

/**
 * Prefetch orders list when hovering over orders link
 */
export const prefetchOrders = async (queryClient: QueryClient) => {
  await queryClient.prefetchQuery({
    queryKey: ['admin', 'orders', { page: 1, limit: 20 }],
    queryFn: () => getOrders({ page: 1, limit: 20 }),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Prefetch next page when user is viewing a paginated list
 * Call when user scrolls to 80% of current page
 */
export const prefetchNextPage = async (
  queryClient: QueryClient,
  currentPage: number,
  queryKey: string[],
  queryFn: (page: number) => Promise<unknown>
) => {
  await queryClient.prefetchQuery({
    queryKey: [...queryKey, currentPage + 1],
    queryFn: () => queryFn(currentPage + 1),
    staleTime: 1 * 60 * 1000,
  });
};

/**
 * Prefetch order details when hovering over an order in a list
 */
export const prefetchOrderDetails = async (
  queryClient: QueryClient,
  trackingCode: string
) => {
  await queryClient.prefetchQuery({
    queryKey: ['order', trackingCode],
    queryFn: () => getOrderById(trackingCode),
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Prefetch related data based on user's likely next action
 * Example: After creating an order, prefetch the order details page
 */
export const prefetchRelatedData = async (
  queryClient: QueryClient,
  context: 'after-order-create' | 'after-login' | 'dashboard-view'
) => {
  switch (context) {
    case 'after-order-create':
      // User likely wants to view their orders next
      await prefetchOrders(queryClient);
      break;

    case 'after-login':
      // Prefetch dashboard for admin/driver, orders for customer
      // This would check user role and prefetch accordingly
      break;

    case 'dashboard-view':
      // Prefetch likely next views
      await prefetchOrders(queryClient);
      break;
  }
};

/**
 * Intelligent prefetching based on user behavior patterns
 * Tracks navigation patterns and prefetches accordingly
 */
class IntelligentPrefetcher {
  private navigationPatterns: Map<string, string[]> = new Map();
  private readonly maxPatternLength = 5;

  trackNavigation(from: string, to: string) {
    const pattern = this.navigationPatterns.get(from) || [];
    pattern.unshift(to);

    if (pattern.length > this.maxPatternLength) {
      pattern.pop();
    }

    this.navigationPatterns.set(from, pattern);
  }

  getMostLikelyNext(current: string): string | null {
    const pattern = this.navigationPatterns.get(current);
    if (!pattern || pattern.length === 0) return null;

    // Return most frequent next page
    const frequency: Map<string, number> = new Map();
    pattern.forEach((page) => {
      frequency.set(page, (frequency.get(page) || 0) + 1);
    });

    let maxFreq = 0;
    let mostLikely: string | null = null;

    frequency.forEach((freq, page) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostLikely = page;
      }
    });

    return mostLikely;
  }

  async prefetchPredicted(
    queryClient: QueryClient,
    currentPage: string
  ): Promise<void> {
    const predicted = this.getMostLikelyNext(currentPage);

    if (predicted) {
      // Prefetch based on prediction
      switch (predicted) {
        case '/admin/dashboard':
          await prefetchDashboard(queryClient);
          break;
        case '/admin/orders':
        case '/portal/orders':
          await prefetchOrders(queryClient);
          break;
        // Add more cases as needed
      }
    }
  }
}

export const intelligentPrefetcher = new IntelligentPrefetcher();

/**
 * Hook for easy prefetching on hover
 * Usage: <Link onMouseEnter={() => prefetchOnHover('dashboard')} />
 */
export const prefetchOnHover = async (
  route: 'dashboard' | 'orders' | 'reports',
  queryClient: QueryClient
) => {
  switch (route) {
    case 'dashboard':
      await prefetchDashboard(queryClient);
      break;
    case 'orders':
      await prefetchOrders(queryClient);
      break;
    // Add more routes as needed
  }
};

/**
 * Prefetch critical data on app load
 * Call this in App.tsx after authentication
 */
export const prefetchCriticalData = async (
  queryClient: QueryClient,
  userRole: 'admin' | 'customer' | 'driver' | 'warehouse'
) => {
  const prefetchTasks: Promise<unknown>[] = [];

  switch (userRole) {
    case 'admin':
      prefetchTasks.push(
        prefetchDashboard(queryClient),
        prefetchOrders(queryClient)
      );
      break;

    case 'customer':
      prefetchTasks.push(prefetchOrders(queryClient));
      break;

    case 'driver':
      // Prefetch driver-specific data
      break;

    case 'warehouse':
      // Prefetch warehouse-specific data
      break;
  }

  await Promise.allSettled(prefetchTasks);
};

export default {
  prefetchDashboard,
  prefetchOrders,
  prefetchNextPage,
  prefetchOrderDetails,
  prefetchRelatedData,
  prefetchOnHover,
  prefetchCriticalData,
  intelligentPrefetcher,
};
