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

export default function RegisterPage() {
  const { login } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (password !== confirm) {
      return 'Passwords do not match.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await authApi.register(email, password, firstName, lastName);
      try {
        const me = await authApi.me();
        login(me.data);
      } catch {
        login({ firstName, lastName, email });
      }
    } catch (err) {
      if (err.code === 'EMAIL_ALREADY_EXISTS') {
        setError('An account with this email already exists.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential) {
    setError('');
    setLoading(true);
    try {
      await authApi.google(credential);
      const me = await authApi.me();
      login(me.data);
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <AuthBrand subtitle="Create your free account" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ada"
              autoComplete="given-name"
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Lovelace"
              autoComplete="family-name"
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
          />

          <PasswordInput
            label="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size={16} />
                Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="mt-4">
          <GoogleSignIn onCredential={handleGoogle} text="signup_with" />
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white dark:bg-slate-800 text-xs text-gray-400 dark:text-gray-500">
              Already have an account?
            </span>
          </div>
        </div>

        <Link href="/login">
          <Button variant="secondary" className="w-full">
            Sign In
          </Button>
        </Link>
      </Card>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        By creating an account, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}