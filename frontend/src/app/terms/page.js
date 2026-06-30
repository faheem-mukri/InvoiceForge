import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — InvoiceForge',
  description: 'The terms governing your use of InvoiceForge.',
};

const UPDATED = 'June 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-800 dark:text-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/login" className="text-sm text-blue-600 dark:text-blue-400">← Back</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">Terms of Service</h1>
        <p className="text-sm text-gray-400 mt-1">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-4 text-sm leading-relaxed">
          <P>
            These Terms govern your use of InvoiceForge. By creating an account or using the service,
            you agree to them.
          </P>

          <H>The service</H>
          <P>
            InvoiceForge lets you create, send, and track invoices and accept payments. We may update,
            add, or remove features over time.
          </P>

          <H>Your account</H>
          <UL items={[
            'You are responsible for the accuracy of the information you enter, including invoice and payment details.',
            'You are responsible for safeguarding your password and for activity under your account.',
            'You must be legally able to enter contracts and use the service for lawful purposes only.',
          ]} />

          <H>Payments</H>
          <P>
            Online card payments are processed by Stripe and are subject to Stripe&apos;s terms. We are
            not a party to the transaction between you and your customers, and we do not hold funds on
            your behalf except as facilitated by the payment processor. You are responsible for the
            correctness of bank and UPI details you publish on invoices.
          </P>

          <H>Acceptable use</H>
          <P>
            You agree not to use InvoiceForge for fraudulent invoicing, money laundering, or any illegal
            activity, and not to disrupt or attempt to gain unauthorized access to the service.
          </P>

          <H>Disclaimer &amp; limitation of liability</H>
          <P>
            The service is provided &quot;as is&quot; without warranties of any kind. To the maximum
            extent permitted by law, InvoiceForge is not liable for indirect, incidental, or
            consequential damages, or for lost profits or data arising from your use of the service.
          </P>

          <H>Termination</H>
          <P>
            You may stop using the service at any time. We may suspend or terminate accounts that violate
            these Terms.
          </P>

          <H>Changes</H>
          <P>
            We may update these Terms. Continued use after changes take effect constitutes acceptance.
          </P>

          <H>Contact</H>
          <P>Questions can be sent to legal@invoiceforge.app.</P>

          <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-slate-800 pt-4 mt-8">
            This document is a starting template and not legal advice. Have it reviewed by qualified
            counsel before relying on it in production.
          </p>
        </div>
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
