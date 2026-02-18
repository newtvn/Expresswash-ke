/**
 * Performance utilities for Uber-level app efficiency
 * Includes service worker registration, Web Vitals monitoring, and performance optimization helpers
 */

// ==========================================
// SERVICE WORKER REGISTRATION
// ==========================================

export const registerServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered successfully:', registration.scope);

    // Check for updates on page load
    registration.update();

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available, prompt user to reload
            if (confirm('New version available! Reload to update?')) {
              window.location.reload();
            }
          }
        });
      }
    });
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
};

// ==========================================
// WEB VITALS MONITORING
// ==========================================

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

type ReportHandler = (metric: WebVitalMetric) => void;

/**
 * Report Web Vitals metrics (LCP, FID, CLS, FCP, TTFB)
 * Follows Google's Core Web Vitals standards
 */
export const reportWebVitals = (onReport: ReportHandler): void => {
  // Largest Contentful Paint (LCP)
  observeLCP(onReport);

  // First Input Delay (FID)
  observeFID(onReport);

  // Cumulative Layout Shift (CLS)
  observeCLS(onReport);

  // First Contentful Paint (FCP)
  observeFCP(onReport);

  // Time to First Byte (TTFB)
  observeTTFB(onReport);
};

// Largest Contentful Paint
function observeLCP(onReport: ReportHandler): void {
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };

    const metric: WebVitalMetric = {
      name: 'LCP',
      value: lastEntry.renderTime || lastEntry.loadTime,
      rating: getRating(lastEntry.renderTime || lastEntry.loadTime, [2500, 4000]),
      delta: lastEntry.renderTime || lastEntry.loadTime,
      id: `v1-${Date.now()}-${Math.random()}`,
    };

    onReport(metric);
  });

  if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }
}

// First Input Delay
function observeFID(onReport: ReportHandler): void {
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();

    for (const entry of entries) {
      const fidEntry = entry as PerformanceEntry & { processingStart: number };
      const metric: WebVitalMetric = {
        name: 'FID',
        value: fidEntry.processingStart - fidEntry.startTime,
        rating: getRating(fidEntry.processingStart - fidEntry.startTime, [100, 300]),
        delta: fidEntry.processingStart - fidEntry.startTime,
        id: `v1-${Date.now()}-${Math.random()}`,
      };

      onReport(metric);
    }
  });

  if (PerformanceObserver.supportedEntryTypes?.includes('first-input')) {
    observer.observe({ type: 'first-input', buffered: true });
  }
}

// Cumulative Layout Shift
function observeCLS(onReport: ReportHandler): void {
  let clsValue = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (!layoutShift.hadRecentInput) {
        clsValue += layoutShift.value;
      }
    }
  });

  if (PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
    observer.observe({ type: 'layout-shift', buffered: true });
  }

  // Report final CLS value on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const metric: WebVitalMetric = {
        name: 'CLS',
        value: clsValue,
        rating: getRating(clsValue, [0.1, 0.25]),
        delta: clsValue,
        id: `v1-${Date.now()}-${Math.random()}`,
      };

      onReport(metric);
    }
  });
}

// First Contentful Paint
function observeFCP(onReport: ReportHandler): void {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        const metric: WebVitalMetric = {
          name: 'FCP',
          value: entry.startTime,
          rating: getRating(entry.startTime, [1800, 3000]),
          delta: entry.startTime,
          id: `v1-${Date.now()}-${Math.random()}`,
        };

        onReport(metric);
        observer.disconnect();
      }
    }
  });

  if (PerformanceObserver.supportedEntryTypes?.includes('paint')) {
    observer.observe({ type: 'paint', buffered: true });
  }
}

// Time to First Byte
function observeTTFB(onReport: ReportHandler): void {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (navigation) {
    const metric: WebVitalMetric = {
      name: 'TTFB',
      value: navigation.responseStart - navigation.requestStart,
      rating: getRating(navigation.responseStart - navigation.requestStart, [800, 1800]),
      delta: navigation.responseStart - navigation.requestStart,
      id: `v1-${Date.now()}-${Math.random()}`,
    };

    onReport(metric);
  }
}

// Helper function to determine rating
function getRating(value: number, thresholds: [number, number]): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds[0]) return 'good';
  if (value <= thresholds[1]) return 'needs-improvement';
  return 'poor';
}

// ==========================================
// DEBOUNCE & THROTTLE
// ==========================================

/**
 * Debounce function - delays execution until after specified wait time has elapsed
 * Use for: search inputs, window resize, scroll events
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is only called once per specified interval
 * Use for: scroll events, mouse movement, API calls
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ==========================================
// IMAGE LAZY LOADING
// ==========================================

/**
 * Lazy load images using Intersection Observer
 * Improves initial page load performance
 */
export const setupLazyLoading = (): void => {
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without Intersection Observer
    return;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;

        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  // Observe all images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
  });
};

// ==========================================
// REQUEST BATCHING
// ==========================================

interface BatchRequest<T> {
  key: string;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Create a batched request handler
 * Combines multiple requests into a single API call
 */
export function createBatchedRequest<T, R>(
  batchFn: (keys: string[]) => Promise<Map<string, R>>,
  delay: number = 10
) {
  let batch: BatchRequest<R>[] = [];
  let timer: NodeJS.Timeout | null = null;

  const executeBatch = async () => {
    const currentBatch = batch;
    batch = [];
    timer = null;

    const keys = currentBatch.map((req) => req.key);

    try {
      const results = await batchFn(keys);

      currentBatch.forEach((req) => {
        const result = results.get(req.key);
        if (result !== undefined) {
          req.resolve(result);
        } else {
          req.reject(new Error(`No result for key: ${req.key}`));
        }
      });
    } catch (error) {
      currentBatch.forEach((req) => req.reject(error));
    }
  };

  return (key: string): Promise<R> => {
    return new Promise((resolve, reject) => {
      batch.push({ key, resolve, reject });

      if (!timer) {
        timer = setTimeout(executeBatch, delay);
      }
    });
  };
}

// ==========================================
// PRELOAD RESOURCES
// ==========================================

/**
 * Preload critical resources
 * Use for fonts, scripts, stylesheets that are needed immediately
 */
export const preloadResource = (url: string, as: string): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Prefetch resources that will be needed soon
 * Use for next page resources, hover states
 */
export const prefetchResource = (url: string): void => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
};

// ==========================================
// PERFORMANCE MONITORING
// ==========================================

/**
 * Measure performance of async functions
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (import.meta.env.DEV) {
      console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
    }

    // Mark performance entry
    performance.mark(`${name}-end`);
    performance.measure(name, { start, end: performance.now() });

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Get current performance metrics
 */
export const getPerformanceMetrics = () => {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    // Navigation timing
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    download: navigation.responseEnd - navigation.responseStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
    domComplete: navigation.domComplete - navigation.fetchStart,
    loadComplete: navigation.loadEventEnd - navigation.fetchStart,

    // Paint timing
    fcp: paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,

    // Resource timing
    resourceCount: performance.getEntriesByType('resource').length,
  };
};
