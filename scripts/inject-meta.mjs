/**
 * Post-build script: Injects route-specific meta tags into static HTML files.
 *
 * For each public route, copies dist/index.html with the correct <title>,
 * <meta description>, <link canonical>, and Open Graph / Twitter tags.
 * This ensures crawlers and social media bots see accurate metadata
 * without requiring a headless browser (Puppeteer) at build time.
 *
 * Usage: node scripts/inject-meta.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const DIST = join(import.meta.dirname, '..', 'dist');
const BASE_URL = 'https://expresscarpets.co.ke';

const routes = [
  {
    path: '/track',
    title: 'Track Your Order | Express Carpets & Upholstery',
    description:
      'Track your carpet, rug, or upholstery cleaning order in real-time. Enter your tracking code to see pickup, cleaning, and delivery status updates.',
    keywords:
      'track order, carpet cleaning status, order tracking, Express Carpets',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Express Carpets & Upholstery',
    description:
      'Learn how Express Carpets & Upholstery collects, uses, and protects your personal information including order details and M-Pesa payment data.',
  },
  {
    path: '/terms',
    title: 'Terms of Service | Express Carpets & Upholstery',
    description:
      'Terms and conditions for using Express Carpets & Upholstery cleaning services in Kitengela, Athi River, Syokimau, and Greater Nairobi.',
  },
  {
    path: '/faq',
    title: 'FAQ — Carpet Cleaning Questions | Express Carpets & Upholstery',
    description:
      'Frequently asked questions about carpet cleaning, sofa washing, pricing, pickup & delivery, and service areas in Kitengela, Syokimau, Athi River & Nairobi.',
    keywords:
      'carpet cleaning FAQ, sofa cleaning questions, Express Carpets help, cleaning service Kitengela',
  },
  {
    path: '/pricing',
    title: 'Pricing — Carpet Cleaning, Sofa Washing & More | Express Carpets Kenya',
    description:
      'Transparent pricing for carpet cleaning, sofa washing, rug cleaning, curtain washing, chair washing & mattress sanitization in Kitengela, Syokimau, Athi River & Nairobi.',
    keywords:
      'carpet cleaning price nairobi, sofa washing cost kitengela, rug cleaning price, curtain washing charges, expresscarpets pricing',
  },
  {
    path: '/contact',
    title: 'Contact Us | Express Carpets & Upholstery',
    description:
      'Get in touch with Express Carpets & Upholstery. Reach us by phone, email, or visit our location in Kitengela, Kenya.',
    keywords:
      'contact Express Carpets, carpet cleaning Kitengela phone, Express Carpets email',
  },
  {
    path: '/services',
    title: 'Our Services — Professional Cleaning | Express Carpets & Upholstery',
    description:
      'Professional carpet cleaning, sofa washing, rug cleaning, curtain washing, chair cleaning & mattress sanitization in Kitengela, Syokimau, Athi River & Nairobi.',
    keywords:
      'carpet cleaning service, sofa washing, rug cleaning, curtain washing, Express Carpets services',
  },
];

const template = readFileSync(join(DIST, 'index.html'), 'utf-8');

for (const route of routes) {
  let html = template;
  const url = `${BASE_URL}${route.path}`;

  // Replace <title>
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(route.title)}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeAttr(route.description)}" />`
  );

  // Replace canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${url}" />`
  );

  // Replace OG tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${url}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeAttr(route.title)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeAttr(route.description)}" />`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${url}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeAttr(route.title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeAttr(route.description)}" />`
  );

  // Replace keywords if provided
  if (route.keywords) {
    html = html.replace(
      /<meta name="keywords" content="[^"]*" \/>/,
      `<meta name="keywords" content="${escapeAttr(route.keywords)}" />`
    );
  }

  // Write to dist/{path}/index.html
  const outDir = join(DIST, route.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`  ✓ ${route.path}/index.html`);
}

console.log(`\nGenerated ${routes.length} route-specific HTML files.`);

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
