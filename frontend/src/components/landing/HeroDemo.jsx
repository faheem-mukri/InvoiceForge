'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

const STAGES = [
  { status: 'Draft', badge: 'bg-gray-100 text-gray-600' },
  { status: 'Sent', badge: 'bg-blue-50 text-blue-700' },
  { status: 'Paid', badge: 'bg-green-50 text-green-700' },
];

// A faithful, lightweight mock of the product UI that cycles an invoice through
// Draft → Sent → Paid to hint at the workflow. Subtle, no heavy motion.
export default function HeroDemo() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % STAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  const stage = STAGES[i];
  const isPaid = stage.status === 'Paid';

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-blue-600/5 overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-slate-800">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-gray-400 font-mono">invoiceforge.app/invoices/INV-0042</span>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">Ada Studio</p>
            <p className="text-xs text-gray-400">hello@adastudio.com</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900 dark:text-white">INVOICE</p>
            <p className="text-xs font-mono text-gray-400">INV-0042</p>
            <span
              className={`inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full transition-all duration-300 ${stage.badge} dark:bg-opacity-20`}
            >
              {stage.status}
            </span>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-4 space-y-2.5 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>Brand identity design</span><span className="tabular-nums">$1,200.00</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>Landing page</span><span className="tabular-nums">$800.00</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400 text-xs">
            <span>Tax (0%)</span><span className="tabular-nums">$0.00</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 dark:text-white border-t border-gray-100 dark:border-slate-800 pt-2.5">
            <span>Total</span><span className="tabular-nums">$2,000.00</span>
          </div>
        </div>

        <div className="mt-5 h-9 flex items-center">
          {isPaid ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 animate-[toastIn_0.3s_ease-out]">
              <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check size={13} />
              </span>
              Paid via Stripe
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {stage.status === 'Draft' ? 'Editing draft…' : 'Awaiting payment…'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
