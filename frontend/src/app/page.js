import Link from 'next/link';
import {
  Zap, FileText, CreditCard, ShieldCheck, Users, Mail, FileDown,
  Smartphone, Moon, LockKeyhole, Banknote, Landmark, QrCode, Cloud,
  Server, ArrowRight, Check,
} from 'lucide-react';

import LandingNav from '@/components/landing/LandingNav';
import HeroDemo from '@/components/landing/HeroDemo';
import Faq from '@/components/landing/Faq';
import Reveal from '@/components/landing/Reveal';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const DESCRIPTION =
  'InvoiceForge is professional invoicing for freelancers, consultants and small businesses. Create polished invoices, accept bank transfer, UPI or online payments, and get paid faster.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'InvoiceForge — Professional invoices in minutes, not hours',
  description: DESCRIPTION,
  keywords: [
    'invoicing', 'invoice generator', 'freelancer invoices', 'online payments',
    'Stripe invoices', 'UPI invoices', 'invoice PDF', 'small business invoicing',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'InvoiceForge — Professional invoices in minutes',
    description: DESCRIPTION,
    url: '/',
    siteName: 'InvoiceForge',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InvoiceForge — Professional invoices in minutes',
    description: DESCRIPTION,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'InvoiceForge',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const VALUE_PROPS = [
  { icon: Zap, title: 'Lightning Fast', body: 'Create professional invoices in minutes with a live-preview editor.' },
  { icon: FileText, title: 'Professional PDFs', body: 'Send polished, branded invoices your clients trust and recognize.' },
  { icon: CreditCard, title: 'Simple Payments', body: 'Accept bank transfer, UPI, or online card payments — your choice.' },
];

const FEATURES = [
  { icon: LockKeyhole, title: 'Secure Authentication', body: 'Cookie-based sessions, optional two-factor, and Google sign-in.' },
  { icon: FileText, title: 'Invoice Management', body: 'Draft, send, track, duplicate, and manage every invoice.' },
  { icon: FileDown, title: 'PDF Export', body: 'Download or attach clean, professional invoice PDFs.' },
  { icon: Mail, title: 'Email Delivery', body: 'Send invoices straight to clients with the PDF attached.' },
  { icon: Users, title: 'Client Management', body: 'Save clients once and reuse their details on any invoice.' },
  { icon: CreditCard, title: 'Payment Tracking', body: 'See what is paid, pending, or overdue at a glance.' },
  { icon: Zap, title: 'Guest Invoices', body: 'Generate a one-off invoice PDF instantly — no account needed.' },
  { icon: Smartphone, title: 'Responsive Design', body: 'Works beautifully on desktop, tablet, and mobile.' },
  { icon: Moon, title: 'Dark Mode', body: 'A refined light and dark theme, your way.' },
];

const STEPS = [
  { n: '1', title: 'Create Invoice', body: 'Add your client and items. Totals, tax, and discounts calculate live.' },
  { n: '2', title: 'Preview PDF', body: 'See exactly what your client will get before you send it.' },
  { n: '3', title: 'Send to Client', body: 'Email the invoice as a PDF with a secure Pay Now link.' },
  { n: '4', title: 'Get Paid', body: 'Clients pay online; the invoice flips to Paid automatically.' },
];

const PAYMENTS = [
  { icon: Banknote, title: 'Cash' },
  { icon: Landmark, title: 'Bank Transfer' },
  { icon: QrCode, title: 'UPI' },
  { icon: CreditCard, title: 'Stripe' },
];

const TRUST = [
  { icon: FileText, title: 'Professional PDFs' },
  { icon: ShieldCheck, title: 'Secure Authentication' },
  { icon: LockKeyhole, title: 'Encrypted Payments' },
  { icon: Cloud, title: 'Cloud Storage' },
  { icon: Smartphone, title: 'Responsive Design' },
  { icon: Server, title: 'Production-grade Architecture' },
];

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <LandingNav />

      <main>
        {/* ── Hero ── */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 lg:pt-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            <Reveal>
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                Invoicing, minus the busywork
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-bold tracking-tight text-gray-900 dark:text-white leading-[1.08]">
                Create professional invoices in minutes, not hours.
              </h1>
              <p className="mt-5 text-lg text-gray-500 dark:text-gray-400 max-w-xl">
                Professional invoicing for freelancers, consultants and small businesses — send
                polished invoices, accept payments, and get paid faster.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Get Started <ArrowRight size={18} />
                </Link>
                <Link
                  href="/guest"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 font-medium transition-colors"
                >
                  Generate Free Invoice
                </Link>
              </div>
              <p className="mt-4 text-xs text-gray-400">No credit card required · Free during beta</p>
            </Reveal>

            <Reveal delay={120}>
              <HeroDemo />
            </Reveal>
          </div>
        </section>

        {/* ── Value proposition ── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {VALUE_PROPS.map((v, idx) => (
              <Reveal key={v.title} delay={idx * 80}>
                <div className="h-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                  <span className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <v.icon size={22} />
                  </span>
                  <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{v.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <SectionHeading
              eyebrow="Features"
              title="Everything you need to bill clients"
              subtitle="Built for speed and clarity. No accounting degree required."
            />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, idx) => (
              <Reveal key={f.title} delay={(idx % 3) * 70}>
                <div className="h-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/5 transition-all">
                  <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center">
                    <f.icon size={20} />
                  </span>
                  <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="bg-gray-50 dark:bg-slate-900/50 border-y border-gray-100 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal>
              <SectionHeading eyebrow="How it works" title="From draft to paid in four steps" />
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((s, idx) => (
                <Reveal key={s.n} delay={idx * 80}>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                      {s.n}
                    </div>
                    <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Invoice preview showcase ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <SectionHeading
              eyebrow="Polished output"
              title="Invoices your clients take seriously"
              subtitle="Every invoice is a clean, branded document with clear totals and payment details."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="max-w-2xl mx-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white shadow-xl p-8 sm:p-10 text-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">AS</span>
                    <p className="font-bold text-gray-900">Ada Studio</p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">123 Market Street<br />hello@adastudio.com<br />GST: 22AAAAA0000A1Z5</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight text-gray-900">INVOICE</p>
                  <p className="text-xs font-mono text-gray-500 mt-1">INV-0042</p>
                  <p className="text-xs text-gray-500 mt-2">Issued: 2026-06-01</p>
                  <p className="text-xs text-gray-500">Due: 2026-06-15</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Bill To</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Globex Inc.</p>
                <p className="text-xs text-gray-500">billing@globex.com</p>
              </div>

              <table className="w-full mt-6 text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Price</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2">Brand identity design</td><td className="py-2 text-right">1</td><td className="py-2 text-right">$1,200.00</td><td className="py-2 text-right">$1,200.00</td></tr>
                  <tr><td className="py-2">Landing page</td><td className="py-2 text-right">1</td><td className="py-2 text-right">$800.00</td><td className="py-2 text-right">$800.00</td></tr>
                </tbody>
              </table>

              <div className="flex justify-end mt-4">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>$2,000.00</span></div>
                  <div className="flex justify-between text-gray-500"><span>GST (18%)</span><span>$360.00</span></div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2"><span>Total</span><span>$2,360.00</span></div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
                <p className="font-semibold text-gray-700">Payment details</p>
                <p>Bank: HDFC Bank · A/C: 50100••••1234 · IFSC: HDFC0000123</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Payment methods ── */}
        <section className="bg-gray-50 dark:bg-slate-900/50 border-y border-gray-100 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal>
              <SectionHeading
                eyebrow="Payments"
                title="Get paid the way you prefer"
                subtitle="Configure your payment methods once — the right details attach to every invoice automatically."
              />
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-3xl mx-auto">
              {PAYMENTS.map((p, idx) => (
                <Reveal key={p.title} delay={idx * 70}>
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col items-center text-center gap-3">
                    <span className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <p.icon size={22} />
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <SectionHeading eyebrow="Built to be trusted" title="Production-grade by design" />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {TRUST.map((t, idx) => (
              <Reveal key={t.title} delay={(idx % 3) * 70}>
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
                  <span className="text-blue-600 dark:text-blue-400"><t.icon size={20} /></span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.title}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="bg-gray-50 dark:bg-slate-900/50 border-y border-gray-100 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal>
              <SectionHeading eyebrow="Pricing" title="Simple pricing" subtitle="Start free. Upgrade when you grow." />
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Reveal>
                <div className="h-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Free</h3>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">$0</p>
                  <p className="text-sm text-gray-400">For getting started</p>
                  <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {['Unlimited invoices', 'Online payments (Stripe)', 'Clients & payment history', 'PDF email delivery'].map((x) => (
                      <li key={x} className="flex items-center gap-2"><Check size={16} className="text-blue-600 dark:text-blue-400" /> {x}</li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-8 block text-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Get started</Link>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="h-full rounded-2xl border-2 border-blue-600 bg-white dark:bg-slate-900 p-8 relative">
                  <span className="absolute -top-3 left-8 text-[10px] font-semibold uppercase tracking-wider bg-blue-600 text-white px-2 py-1 rounded-full">Coming soon</span>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Pro</h3>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">TBD</p>
                  <p className="text-sm text-gray-400">For growing businesses</p>
                  <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {['Everything in Free', 'Recurring invoices', 'Custom branding', 'Automated reminders'].map((x) => (
                      <li key={x} className="flex items-center gap-2"><Check size={16} className="text-blue-600 dark:text-blue-400" /> {x}</li>
                    ))}
                  </ul>
                  <button disabled className="mt-8 block w-full text-center px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-400 text-sm font-medium cursor-not-allowed">Notify me</button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
          </Reveal>
          <Faq />
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <Reveal>
            <div className="rounded-3xl bg-blue-600 px-8 py-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to simplify invoicing?</h2>
              <p className="mt-3 text-blue-100">Create your first invoice today — it takes about two minutes.</p>
              <Link href="/register" className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-blue-700 font-semibold hover:bg-blue-50 transition-colors">
                Get Started <ArrowRight size={18} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><FileText size={18} /></span>
              <span className="font-bold text-gray-900 dark:text-white">InvoiceForge</span>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Professional invoicing for freelancers and small businesses.
            </p>
          </div>

          <FooterCol title="Product" links={[
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Guest invoice', href: '/guest' },
          ]} />
          <FooterCol title="Resources" links={[
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'FAQ', href: '#faq' },
          ]} />
          <FooterCol title="Account" links={[
            { label: 'Login', href: '/login' },
            { label: 'Get Started', href: '/register' },
          ]} />
        </div>
        <div className="border-t border-gray-100 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-6 text-center sm:text-left">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} InvoiceForge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
