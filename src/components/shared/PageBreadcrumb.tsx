import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbEntry[];
}

const BASE_URL = 'https://expresscarpets.co.ke';

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  const allItems: BreadcrumbEntry[] = [{ label: 'Home', href: '/' }, ...items];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: allItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${BASE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          {allItems.map((entry, i) => {
            const isLast = i === allItems.length - 1;
            return (
              <BreadcrumbItem key={entry.label}>
                {!isLast && entry.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={entry.href}>{entry.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{entry.label}</BreadcrumbPage>
                )}
                {!isLast && <BreadcrumbSeparator />}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
