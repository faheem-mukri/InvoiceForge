'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

import Card from '@/components/ui/Card';
import PasswordInput from '@/components/ui/PasswordInput';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import AuthBrand from '@/components/auth/AuthBrand';

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert variant="error">This reset link is missing its token. Please request a new one.</Alert>
        <Link href="/forgot-password"><Button variant="secondary" className="w-full">Request New Link</Button></Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">Your password has been reset. Redirecting to sign in…</Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PasswordInput
        label="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Min. 8 characters"
        autoComplete="new-password"
        required
      />
      <PasswordInput
        label="Confirm New Password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
      />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <span className="flex items-center gap-2"><Spinner size={16} /> Resetting…</span> : 'Reset Password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <AuthBrand subtitle="Choose a new password" />
      <Card>
        <Suspense fallback={<div className="flex justify-center py-6"><Spinner size={20} /></div>}>
          <ResetForm />
        </Suspense>
      </Card>
    </div>
  );
}
