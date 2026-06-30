import ClientProviders from '@/components/layout/ClientProviders';
import './global.css';

export const metadata = {
  title: 'InvoiceForge',
  description: 'Invoicing for freelancers and small businesses',
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