import { Outlet } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { PageErrorBoundary } from '@/components/ErrorBoundary';

const PublicLayout = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">
      <PageErrorBoundary fallbackTitle="Page Error">
        <Outlet />
      </PageErrorBoundary>
    </main>
    <Footer />
  </div>
);

export default PublicLayout;
