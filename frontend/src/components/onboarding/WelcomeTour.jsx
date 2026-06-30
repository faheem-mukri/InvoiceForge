'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Building2,
  FilePlus2,
  Send,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';

const STORAGE_PREFIX = 'invoiceforge:tutorial:';
// Auto-show only for recently created accounts so existing users aren't
// surprised by it. Anyone can replay it manually from Settings.
const AUTO_SHOW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Fired from Settings ("Replay product tour") to re-open the tour on demand.
export const START_TOUR_EVENT = 'invoiceforge:start-tour';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to InvoiceForge',
    body: 'Create professional invoices, send them as polished PDFs, and get paid — all in a few minutes. Here\u2019s the quick tour.',
  },
  {
    icon: Building2,
    title: 'Set up your business & payments',
    body: 'Add your business details and choose how clients pay you — bank transfer, UPI, or online card payments via Stripe. This appears on every invoice you send.',
    cta: { label: 'Open Settings', href: '/settings' },
  },
  {
    icon: FilePlus2,
    title: 'Create your first invoice',
    body: 'Pick a client, add line items, and watch the live preview update as you type. Taxes and totals are calculated automatically.',
    cta: { label: 'New Invoice', href: '/invoices/new' },
  },
  {
    icon: Send,
    title: 'Send it and get paid',
    body: 'Email the invoice with the PDF attached, then track its status from Draft \u2192 Sent \u2192 Paid. When a client pays online, it\u2019s marked paid automatically.',
  },
];

export default function WelcomeTour() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = user?.id ? STORAGE_PREFIX + user.id : null;

  // Auto-open for first-time users.
  useEffect(() => {
    if (loading || !user?.id || typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_PREFIX + user.id)) return;

    const created = user.createdAt ? new Date(user.createdAt).getTime() : null;
    const recent =
      created == null || Date.now() - created < AUTO_SHOW_MAX_AGE_MS;
    if (recent) {
      setStep(0);
      setOpen(true);
    }
  }, [loading, user]);

  // Manual replay from Settings.
  useEffect(() => {
    function start() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  const dismiss = useCallback(
    (navigateTo) => {
      if (storageKey) localStorage.setItem(storageKey, '1');
      setOpen(false);
      if (navigateTo) router.push(navigateTo);
    },
    [storageKey, router]
  );

  // Escape closes (counts as "got it").
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') dismiss();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismiss]);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 animate-[overlayIn_0.15s_ease-out]"
        onClick={() => dismiss()}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 animate-[modalIn_0.18s_ease-out] overflow-hidden"
      >
        {/* Skip */}
        <button
          type="button"
          onClick={() => dismiss()}
          className="absolute top-4 right-4 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          Skip
        </button>

        <div className="px-6 pt-8 pb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-5">
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {current.body}
          </p>

          {current.cta && (
            <button
              type="button"
              onClick={() => dismiss(current.cta.href)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              {current.cta.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Footer: progress dots + nav */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-5 bg-blue-600 dark:bg-blue-400'
                    : 'w-1.5 bg-gray-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="secondary"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Back
                </span>
              </Button>
            )}
            {isLast ? (
              <Button onClick={() => dismiss('/invoices/new')}>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Create my first invoice
                </span>
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                <span className="flex items-center gap-1.5">
                  Next <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
