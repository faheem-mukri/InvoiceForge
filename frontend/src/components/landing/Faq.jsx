'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ITEMS = [
  { q: 'Is InvoiceForge free?', a: 'Yes — InvoiceForge is free during beta. You can create unlimited invoices, send them, and accept payments at no cost.' },
  { q: 'Can I create invoices without an account?', a: 'Absolutely. Use the guest invoice generator to create and download a professional PDF instantly, no sign-up required.' },
  { q: 'Can I download PDFs?', a: 'Every invoice can be downloaded as a clean, professional PDF, and it is also attached automatically when you email a client.' },
  { q: 'Can I send invoices by email?', a: 'Yes. Sending an invoice emails your client the PDF, with a secure "Pay Now" link for online (Stripe) payments.' },
  { q: 'Does InvoiceForge support UPI?', a: 'Yes. Save your UPI ID once in Payment Settings and it is attached to invoices automatically when you choose UPI.' },
  { q: 'Can I accept Stripe payments?', a: 'Yes. Customers can pay by card through Stripe Checkout, and the invoice is marked Paid automatically once payment succeeds.' },
  { q: 'Can I customize invoices?', a: 'You can set your business details, logo info, currency, tax, discounts, notes, and terms — they flow onto every invoice.' },
  { q: 'Will more payment providers be added?', a: 'The payment layer is provider-agnostic. Stripe is supported today; providers like Razorpay, PayPal, and others can be added without changing your invoices.' },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="max-w-3xl mx-auto divide-y divide-gray-100 dark:divide-slate-800 border-y border-gray-100 dark:border-slate-800">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left focus-visible:ring-2 focus-visible:ring-blue-500 outline-none rounded-lg"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-gray-900 dark:text-white">{item.q}</span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-5' : 'max-h-0'}`}
            >
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
