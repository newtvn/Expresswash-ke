import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
}

const setMetaTag = (selector: string, attrKey: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrKey.split('=')[0].replace('[', '').replace('"', ''), attrKey.split('=')[1].replace('"', '').replace(']', ''));
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

export function useSEO({ title, description, keywords, canonical }: SEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const updateMeta = (attr: string, val: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${val}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    updateMeta('name', 'description', description);
    if (keywords) updateMeta('name', 'keywords', keywords);
    updateMeta('property', 'og:title', title);
    updateMeta('property', 'og:description', description);
    updateMeta('name', 'twitter:title', title);
    updateMeta('name', 'twitter:description', description);

    if (canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (link) link.setAttribute('href', canonical);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, keywords, canonical]);
}
