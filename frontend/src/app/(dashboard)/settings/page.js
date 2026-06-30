'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { userApi, businessApi, paymentSettingsApi, authApi } from '@/lib/api';

import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { START_TOUR_EVENT } from '@/components/onboarding/WelcomeTour';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'business', label: 'Business Information' },
  { id: 'payments', label: 'Payment Settings' },
  { id: 'defaults', label: 'Invoice Defaults' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
];

export default function SettingsPage() {
  const { token, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const [active, setActive] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', authProvider: 'LOCAL' });
  const [business, setBusiness] = useState(null);
  const [pay, setPay] = useState(null);
  const [notif, setNotif] = useState({ notifyOnPaid: true, notifyReminders: false });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [twoFa, setTwoFa] = useState({ enabled: false, setup: null, code: '' });
  const [del, setDel] = useState({ open: false, password: '', working: false });

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [me, ps] = await Promise.all([userApi.me(token), paymentSettingsApi.get(token)]);
        setProfile({ firstName: me.data.firstName || '', lastName: me.data.lastName || '', email: me.data.email || '', authProvider: me.data.authProvider || 'LOCAL' });
        setBusiness(me.data.business || {});
        setPay(ps.data);
        setNotif({
          notifyOnPaid: me.data.notifyOnPaid !== false,
          notifyReminders: !!me.data.notifyReminders,
        });
        setTwoFa((t) => ({ ...t, enabled: !!me.data.twoFactorEnabled }));

        // Refresh live Stripe Connect status (and react to an onboarding return).
        const returningFromStripe =
          typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('stripe');
        if (ps.data.stripe_account_id || returningFromStripe) {
          try {
            const st = await paymentSettingsApi.stripeStatus(token);
            setPay((p) => ({
              ...p,
              stripe_account_id: st.data.stripe_account_id,
              stripe_connection_status: st.data.stripe_connection_status,
            }));
            if (returningFromStripe) {
              window.history.replaceState({}, '', window.location.pathname);
              setActive('payments');
              if (st.data.stripe_connection_status === 'CONNECTED') {
                toast.success('Stripe account connected — online payments are live.');
              } else {
                toast.info('Stripe onboarding is still pending. Finish it to accept online payments.');
              }
            }
          } catch {
            /* non-fatal */
          }
        }
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        else toast.error(err.message || 'Could not load settings.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  function setB(field, value) {
    setBusiness((p) => ({ ...p, [field]: value }));
  }
  function setP(field, value) {
    setPay((p) => ({ ...p, [field]: value }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving('profile');
    try {
      await userApi.update(token, { firstName: profile.firstName, lastName: profile.lastName });
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save profile.');
    } finally {
      setSaving('');
    }
  }

  async function saveBusiness(e) {
    e.preventDefault();
    setSaving('business');
    try {
      const res = await businessApi.update(token, {
        business_name: business.business_name,
        business_email: business.business_email,
        business_phone: business.business_phone,
        business_address: business.business_address,
        website: business.website,
        gst_number: business.gst_number,
        tax_id: business.tax_id,
      });
      setBusiness(res.data);
      toast.success('Business profile saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save business profile.');
    } finally {
      setSaving('');
    }
  }

  async function saveDefaults(e) {
    e.preventDefault();
    setSaving('defaults');
    try {
      const res = await businessApi.update(token, {
        default_currency: business.default_currency,
        invoice_prefix: business.invoice_prefix,
      });
      setBusiness(res.data);
      if (pay) {
        const ps = await paymentSettingsApi.update(token, { default_method: pay.default_method || null });
        setPay(ps.data);
      }
      toast.success('Invoice defaults saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save defaults.');
    } finally {
      setSaving('');
    }
  }

  async function savePayments(e) {
    e.preventDefault();
    setSaving('payments');
    try {
      const res = await paymentSettingsApi.update(token, {
        cash_enabled: pay.cash_enabled,
        bank_enabled: pay.bank_enabled,
        upi_enabled: pay.upi_enabled,
        stripe_enabled: pay.stripe_enabled,
        bank_name: pay.bank_name,
        account_holder_name: pay.account_holder_name,
        account_number: pay.account_number,
        ifsc_swift_code: pay.ifsc_swift_code,
        branch_name: pay.branch_name,
        account_type: pay.account_type,
        upi_id: pay.upi_id,
        upi_merchant_name: pay.upi_merchant_name,
      });
      setPay(res.data);
      toast.success('Payment settings saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save payment settings.');
    } finally {
      setSaving('');
    }
  }

  async function connectStripe() {
    setSaving('stripe');
    try {
      const res = await paymentSettingsApi.stripeConnect(token);
      if (res.data?.url) window.location.href = res.data.url;
    } catch (err) {
      if (err.code === 'STRIPE_CONNECT_UNAVAILABLE') {
        toast.error('Stripe Connect needs to be enabled on the platform Stripe account before businesses can connect. (Dashboard → Connect.)');
      } else {
        toast.error(err.message || 'Could not start Stripe onboarding.');
      }
    } finally {
      setSaving('');
    }
  }

  async function saveNotifications(e) {
    e.preventDefault();
    setSaving('notifications');
    try {
      await userApi.update(token, {
        notifyOnPaid: notif.notifyOnPaid,
        notifyReminders: notif.notifyReminders,
      });
      toast.success('Notification preferences saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save notifications.');
    } finally {
      setSaving('');
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSaving('security');
    try {
      await authApi.changePassword(token, pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      toast.success('Password updated.');
    } catch (err) {
      toast.error(err.message || 'Could not change password.');
    } finally {
      setSaving('');
    }
  }

  async function startTwoFa() {
    setSaving('2fa-setup');
    try {
      const res = await authApi.twoFactorSetup();
      setTwoFa((t) => ({ ...t, setup: res.data, code: '' }));
    } catch (err) {
      toast.error(err.message || 'Could not start 2FA setup.');
    } finally {
      setSaving('');
    }
  }

  async function confirmTwoFa(e) {
    e.preventDefault();
    setSaving('2fa-enable');
    try {
      await authApi.twoFactorEnable(twoFa.code.trim());
      setTwoFa({ enabled: true, setup: null, code: '' });
      toast.success('Two-factor authentication enabled.');
    } catch (err) {
      toast.error(err.message || 'Invalid code.');
    } finally {
      setSaving('');
    }
  }

  async function disableTwoFa(e) {
    e.preventDefault();
    setSaving('2fa-disable');
    try {
      await authApi.twoFactorDisable(twoFa.code.trim());
      setTwoFa({ enabled: false, setup: null, code: '' });
      toast.success('Two-factor authentication disabled.');
    } catch (err) {
      toast.error(err.message || 'Invalid code.');
    } finally {
      setSaving('');
    }
  }

  async function handleDeleteAccount() {
    setDel((d) => ({ ...d, working: true }));
    try {
      await authApi.deleteAccount(token, del.password);
      toast.success('Your account is scheduled for deletion. Log in within 30 days to restore it.');
      setDel({ open: false, password: '', working: false });
      await logout();
    } catch (err) {
      toast.error(err.message || 'Could not delete account.');
      setDel((d) => ({ ...d, working: false }));
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, business, and payment configuration." />

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        {/* Section nav */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`text-left whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active === s.id
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="max-w-2xl">
          {active === 'profile' && (
            <form onSubmit={saveProfile}>
              <Card className="space-y-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Profile</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="First Name" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                  <Input label="Last Name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                </div>
                <Input label="Email" value={profile.email} disabled />
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving === 'profile'}>{saving === 'profile' ? <Spinner size={16} /> : 'Save'}</Button>
                </div>
              </Card>
            </form>
          )}

          {active === 'business' && (
            <form onSubmit={saveBusiness}>
              <Card className="space-y-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Business Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Business Name" value={business.business_name || ''} onChange={(e) => setB('business_name', e.target.value)} />
                  <Input label="Business Email" type="email" value={business.business_email || ''} onChange={(e) => setB('business_email', e.target.value)} />
                  <Input label="Phone" value={business.business_phone || ''} onChange={(e) => setB('business_phone', e.target.value)} />
                  <Input label="Website" value={business.website || ''} onChange={(e) => setB('website', e.target.value)} placeholder="https://" />
                  <Input label="GST / VAT Number" value={business.gst_number || ''} onChange={(e) => setB('gst_number', e.target.value)} />
                  <Input label="Tax ID" value={business.tax_id || ''} onChange={(e) => setB('tax_id', e.target.value)} />
                </div>
                <Textarea label="Business Address" value={business.business_address || ''} onChange={(e) => setB('business_address', e.target.value)} rows={2} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving === 'business'}>{saving === 'business' ? <Spinner size={16} /> : 'Save'}</Button>
                </div>
              </Card>
            </form>
          )}

          {active === 'payments' && pay && (
            <form onSubmit={savePayments}>
              <Card className="space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Payment Methods</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only enabled methods appear when creating an invoice.</p>
                </div>

                <div className="space-y-3 border-b border-gray-100 dark:border-slate-800 pb-5">
                  <Toggle label="Cash" checked={!!pay.cash_enabled} onChange={(v) => setP('cash_enabled', v)} />
                  <Toggle label="Bank Transfer" checked={!!pay.bank_enabled} onChange={(v) => setP('bank_enabled', v)} />
                  <Toggle label="UPI" checked={!!pay.upi_enabled} onChange={(v) => setP('upi_enabled', v)} />
                  <Toggle
                    label="Online Payment (Stripe)"
                    description={`Status: ${(pay.stripe_connection_status || 'NOT_CONNECTED').replace('_', ' ')}`}
                    checked={!!pay.stripe_enabled}
                    onChange={(v) => setP('stripe_enabled', v)}
                  />
                </div>

                {pay.bank_enabled && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bank Transfer Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Bank Name" value={pay.bank_name || ''} onChange={(e) => setP('bank_name', e.target.value)} />
                      <Input label="Account Holder Name" value={pay.account_holder_name || ''} onChange={(e) => setP('account_holder_name', e.target.value)} />
                      <Input label="Account Number" value={pay.account_number || ''} onChange={(e) => setP('account_number', e.target.value)} />
                      <Input label="IFSC / SWIFT Code" value={pay.ifsc_swift_code || ''} onChange={(e) => setP('ifsc_swift_code', e.target.value)} />
                      <Input label="Branch Name" value={pay.branch_name || ''} onChange={(e) => setP('branch_name', e.target.value)} />
                      <Input label="Account Type" value={pay.account_type || ''} onChange={(e) => setP('account_type', e.target.value)} />
                    </div>
                  </div>
                )}

                {pay.upi_enabled && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">UPI Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="UPI ID" value={pay.upi_id || ''} onChange={(e) => setP('upi_id', e.target.value)} />
                      <Input label="Merchant Name" value={pay.upi_merchant_name || ''} onChange={(e) => setP('upi_merchant_name', e.target.value)} />
                    </div>
                  </div>
                )}

                {pay.stripe_enabled && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stripe — get paid online</h3>
                    {pay.stripe_connection_status === 'CONNECTED' ? (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        ✓ Connected. Online card payments are deposited directly into your Stripe account.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Connect your Stripe account so customers can pay invoices by card. Payments go
                          straight to <span className="font-medium">your</span> Stripe balance — we never
                          hold your money. Until you connect, the &quot;Online&quot; method won&apos;t appear on invoices.
                        </p>
                        <Button type="button" variant="secondary" onClick={connectStripe} disabled={saving === 'stripe'}>
                          {saving === 'stripe' ? <Spinner size={16} /> : 'Connect with Stripe'}
                        </Button>
                      </>
                    )}
                    <p className="text-xs text-gray-400">Card details are never stored by InvoiceForge — Stripe handles all card data.</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving === 'payments'}>{saving === 'payments' ? <Spinner size={16} /> : 'Save Payment Settings'}</Button>
                </div>
              </Card>
            </form>
          )}

          {active === 'defaults' && (
            <form onSubmit={saveDefaults}>
              <Card className="space-y-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Defaults</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Select label="Default Currency" value={business.default_currency || 'USD'} onChange={(e) => setB('default_currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                  <Input label="Invoice Prefix" value={business.invoice_prefix || ''} onChange={(e) => setB('invoice_prefix', e.target.value)} placeholder="INV" />
                  <Select
                    label="Default Payment Method"
                    value={pay?.default_method || ''}
                    onChange={(e) => setP('default_method', e.target.value)}
                    options={[
                      { value: '', label: 'None' },
                      { value: 'CASH', label: 'Cash' },
                      { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'ONLINE', label: 'Online' },
                    ]}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving === 'defaults'}>{saving === 'defaults' ? <Spinner size={16} /> : 'Save'}</Button>
                </div>
              </Card>
            </form>
          )}

          {active === 'notifications' && (
            <form onSubmit={saveNotifications}>
              <Card className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h2>
                <Toggle
                  label="Email me when an invoice is paid"
                  description="Get notified the moment a customer pays online."
                  checked={notif.notifyOnPaid}
                  onChange={(v) => setNotif((n) => ({ ...n, notifyOnPaid: v }))}
                />
                <Toggle
                  label="Payment reminders to clients"
                  description="Automatically remind clients about overdue invoices (scheduled reminders roll out soon)."
                  checked={notif.notifyReminders}
                  onChange={(v) => setNotif((n) => ({ ...n, notifyReminders: v }))}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving === 'notifications'}>
                    {saving === 'notifications' ? <Spinner size={16} /> : 'Save'}
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {active === 'security' && (
            <div className="space-y-6">
              <form onSubmit={changePassword}>
                <Card className="space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Password</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Signed in as {profile.email}.</p>
                  </div>
                  <PasswordInput
                    label="Current Password"
                    value={pwd.current}
                    onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                    autoComplete="current-password"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PasswordInput
                      label="New Password"
                      value={pwd.next}
                      onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      required
                    />
                    <PasswordInput
                      label="Confirm New Password"
                      value={pwd.confirm}
                      onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving === 'security'}>
                      {saving === 'security' ? <Spinner size={16} /> : 'Change Password'}
                    </Button>
                  </div>
                </Card>
              </form>

              <Card className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Add a one-time code from an authenticator app (Google Authenticator, Authy, 1Password) at sign-in.
                  </p>
                </div>

                {twoFa.enabled ? (
                  <form onSubmit={disableTwoFa} className="space-y-3">
                    <p className="text-sm text-green-600 dark:text-green-400">✓ Two-factor authentication is on.</p>
                    <Input
                      label="Enter a current code to disable"
                      value={twoFa.code}
                      onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })}
                      placeholder="123456"
                      inputMode="numeric"
                      required
                    />
                    <div className="flex justify-end">
                      <Button type="submit" variant="danger" disabled={saving === '2fa-disable'}>
                        {saving === '2fa-disable' ? <Spinner size={16} /> : 'Disable 2FA'}
                      </Button>
                    </div>
                  </form>
                ) : twoFa.setup ? (
                  <form onSubmit={confirmTwoFa} className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={twoFa.setup.qr} alt="2FA QR code" className="w-44 h-44 rounded-lg border border-gray-200 dark:border-slate-700 bg-white p-2" />
                    <p className="text-xs text-gray-400 break-all">
                      Can&apos;t scan? Enter this key manually: <span className="font-mono">{twoFa.setup.secret}</span>
                    </p>
                    <Input
                      label="Verification Code"
                      value={twoFa.code}
                      onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })}
                      placeholder="123456"
                      inputMode="numeric"
                      required
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setTwoFa({ ...twoFa, setup: null, code: '' })}>Cancel</Button>
                      <Button type="submit" disabled={saving === '2fa-enable'}>
                        {saving === '2fa-enable' ? <Spinner size={16} /> : 'Enable 2FA'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button type="button" variant="secondary" onClick={startTwoFa} disabled={saving === '2fa-setup'}>
                    {saving === '2fa-setup' ? <Spinner size={16} /> : 'Enable Two-Factor Authentication'}
                  </Button>
                )}
              </Card>

              {/* Danger zone */}
              <Card className="space-y-3 border-red-200 dark:border-red-900/50">
                <div>
                  <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Schedule your account for deletion. Your data — invoices, clients, payment
                    settings, and history — is kept for 30 days, during which you can restore
                    everything just by logging back in. After 30 days it is permanently erased.
                  </p>
                </div>
                <div>
                  <Button type="button" variant="danger" onClick={() => setDel({ open: true, password: '', working: false })}>
                    Delete Account
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {active === 'appearance' && (
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Appearance</h2>
              <Toggle
                label="Dark mode"
                description="Switch between light and dark themes"
                checked={theme === 'dark'}
                onChange={toggleTheme}
              />

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Product tour</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Replay the quick getting-started walkthrough.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
                  >
                    Replay tour
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={del.open}
        onClose={() => setDel({ open: false, password: '', working: false })}
        onConfirm={handleDeleteAccount}
        title="Delete your account?"
        confirmLabel="Schedule deletion"
        variant="danger"
        loading={del.working}
        description={
          <div className="space-y-3">
            <p>
              Your account will be scheduled for deletion and you&apos;ll be signed out. Your data —
              invoices, clients, payment settings, and history — is kept for <strong>30 days</strong>.
              Change your mind? Just log back in within those 30 days and everything is restored.
              After 30 days it is permanently erased.
            </p>
            {profile.authProvider === 'LOCAL' && (
              <PasswordInput
                label="Confirm your password"
                value={del.password}
                onChange={(e) => setDel((d) => ({ ...d, password: e.target.value }))}
                autoComplete="current-password"
              />
            )}
          </div>
        }
      />
    </div>
  );
}
