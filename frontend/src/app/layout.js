import ClientProviders from '@/components/layout/ClientProviders';
import './global.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'InvoiceForge',
  description: 'Invoicing for freelancers and small businesses',
  openGraph: {
    title: 'InvoiceForge',
    description: 'Invoicing for freelancers and small businesses',
    siteName: 'InvoiceForge',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'InvoiceForge' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InvoiceForge',
    description: 'Invoicing for freelancers and small businesses',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-gray-900 dark:bg-slate-950 dark:text-gray-100 antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}