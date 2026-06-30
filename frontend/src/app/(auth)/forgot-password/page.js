'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import AuthBrand from '@/components/auth/AuthBrand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      // Endpoint always succeeds; show the same confirmation regardless.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <AuthBrand subtitle="Reset your password" />
      <Card>
        {sent ? (
          <div className="space-y-4">
            <Alert variant="success">
              If an account exists for {email || 'that email'}, a reset link is on its way. Check your inbox.
            </Alert>
            <Link href="/login">
              <Button variant="secondary" className="w-full">Back to Sign In</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your account email and we&apos;ll send you a link to reset your password.
            </p>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2"><Spinner size={16} /> Sending…</span>
              ) : (
                'Send Reset Link'
              )}
            </Button>
            <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
              Back to Sign In
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
