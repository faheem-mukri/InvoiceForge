import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — InvoiceForge',
  description: 'How InvoiceForge collects, uses, and protects your data.',
};

const UPDATED = 'June 2026';

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <P>
        InvoiceForge (&quot;we&quot;, &quot;us&quot;) provides invoicing software for freelancers and
        small businesses. This policy explains what data we collect, why, and how we handle it.
      </P>

      <H>Information we collect</H>
      <UL items={[
        'Account data: your name, email address, and hashed password.',
        'Business profile: business name, address, contact details, and tax identifiers you enter.',
        'Client and invoice data: the client details, line items, and amounts you create.',
        'Payment configuration: bank/UPI details you choose to store, and your Stripe connection status.',
        'Usage and technical data: log data such as IP address and timestamps for security and debugging.',
      ]} />

      <H>What we do not collect</H>
      <P>
        We never store card numbers, CVV codes, or customer card data. All card payments are processed
        by Stripe. We never sell your data.
      </P>

      <H>How we use your data</H>
      <UL items={[
        'To create, send, and manage your invoices.',
        'To email invoices (as PDF attachments) and payment receipts to the recipients you specify.',
        'To process online payments through Stripe.',
        'To secure your account and prevent abuse.',
      ]} />

      <H>Third-party processors</H>
      <P>
        We rely on trusted processors to operate the service, including Stripe (payments) and an email
        delivery provider (transactional email). These providers process data only as needed to provide
        their service.
      </P>

      <H>Data storage &amp; security</H>
      <P>
        Passwords are hashed with bcrypt. Data is transmitted over HTTPS in production. We apply
        reasonable technical and organizational measures to protect your data, though no method of
        transmission or storage is completely secure.
      </P>

      <H>Your rights</H>
      <P>
        You may access, update, or request deletion of your data by contacting us. Deleting your account
        removes your invoices, clients, and payment configuration.
      </P>

      <H>Contact</H>
      <P>Questions about this policy can be sent to privacy@invoiceforge.app.</P>

      <Note />
    </LegalShell>
  );
}

function LegalShell({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-800 dark:text-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/login" className="text-sm text-blue-600 dark:text-blue-400">← Back</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">Last updated: {updated}</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function H({ children }) {
  return <h2 className="text-base font-semibold text-gray-900 dark:text-white pt-4">{children}</h2>;
}
function P({ children }) {
  return <p className="text-gray-600 dark:text-gray-300">{children}</p>;
}
function UL({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
function Note() {
  return (
    <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-slate-800 pt-4 mt-8">
      This document is a starting template and not legal advice. Have it reviewed by qualified counsel
      before relying on it in production.
    </p>
  );
}
