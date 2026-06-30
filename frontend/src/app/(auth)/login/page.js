'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import AuthBrand from '@/components/auth/AuthBrand';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

export default function LoginPage() {
  const { login } = useAuth();

  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [restored, setRestored] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function finishLogin(wasRestored) {
    // If the account had a scheduled deletion, logging in cancelled it. Stash a
    // one-shot flag so the dashboard can welcome the user back.
    if (wasRestored && typeof window !== 'undefined') {
      sessionStorage.setItem('accountRestored', '1');
    }
    // Cookies are set; fetch the profile so the UI has the user immediately.
    try {
      const me = await authApi.me();
      login(me.data);
    } catch {
      login(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.data?.twoFactorRequired) {
        setMfaToken(res.data.mfaToken);
        setRestored(!!res.data.restored);
        setStep('2fa');
      } else {
        await finishLogin(!!res.data?.restored);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.twoFactorLogin(mfaToken, code.trim());
      await finishLogin(restored);
    } catch (err) {
      setError(err.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential) {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.google(credential);
      await finishLogin(!!res.data?.restored);
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  if (step === '2fa') {
    return (
      <div className="w-full max-w-md">
        <AuthBrand subtitle="Two-factor authentication" />
        <Card>
          <form onSubmit={handleVerify} className="space-y-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter the 6-digit code from your authenticator app.
            </p>
            <Input
              label="Authentication Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <span className="flex items-center gap-2"><Spinner size={16} /> Verifying…</span> : 'Verify'}
            </Button>
            <button
              type="button"
              onClick={() => { setStep('login'); setCode(''); setError(''); }}
              className="block w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Back
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <AuthBrand subtitle="Sign in to manage your invoices" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size={16} />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-4">
          <GoogleSignIn onCredential={handleGoogle} text="signin_with" />
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white dark:bg-slate-800 text-xs text-gray-400 dark:text-gray-500">
              Don&apos;t have an account?
            </span>
          </div>
        </div>

        <Link href="/register">
          <Button variant="secondary" className="w-full">
            Create Account
          </Button>
        </Link>

        <Link
          href="/guest"
          className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          Or generate a quick invoice without an account →
        </Link>
      </Card>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
}
