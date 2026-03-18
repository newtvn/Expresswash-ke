import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/** Scrolls to the hash target after navigation */
function ScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;
    // Small delay so the DOM has rendered after route change
    const timer = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [hash, pathname]);

  return null;
}

const PublicLayout = () => (
  <div className="min-h-screen flex flex-col">
    <ScrollToHash />
    <Header />
    <main className="flex-1">
      <ErrorBoundary fullPage={true} showHomeButton={true} fallbackTitle="Page Error">
        <Outlet />
      </ErrorBoundary>
    </main>
    <Footer />
  </div>
);

export default PublicLayout;
