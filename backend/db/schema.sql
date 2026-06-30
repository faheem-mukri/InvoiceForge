-- =====================================================================
-- InvoiceForge — Complete V1 schema
-- Single source of truth. Run this once on a fresh/empty database to
-- provision the full schema.
--
-- Money is stored as integers in the smallest currency unit (cents).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'LOCAL' CHECK (auth_provider IN ('LOCAL', 'GOOGLE', 'APPLE')),
  google_id TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  notify_on_paid BOOLEAN NOT NULL DEFAULT true,
  notify_reminders BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_login_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- =========================
-- BUSINESS PROFILE (one per user)
-- =========================
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,
  business_address TEXT,
  business_logo TEXT,
  website TEXT,
  gst_number TEXT,
  tax_id TEXT,

  default_currency TEXT NOT NULL DEFAULT 'USD',
  default_payment_method TEXT CHECK (
    default_payment_method IN ('CASH', 'COD', 'BANK_TRANSFER', 'ONLINE', 'UPI', 'CARD')
  ),
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  invoice_counter INT NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_business_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- PAYMENT SETTINGS (one per user) — reusable payment configuration
-- =========================
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- enabled methods
  cash_enabled BOOLEAN NOT NULL DEFAULT true,
  bank_enabled BOOLEAN NOT NULL DEFAULT false,
  upi_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_enabled BOOLEAN NOT NULL DEFAULT false,
  default_method TEXT CHECK (default_method IN ('CASH', 'BANK_TRANSFER', 'UPI', 'ONLINE')),

  -- bank transfer
  bank_name TEXT,
  account_holder_name TEXT,
  account_number TEXT,
  ifsc_swift_code TEXT,
  branch_name TEXT,
  account_type TEXT,

  -- upi
  upi_id TEXT,
  upi_merchant_name TEXT,

  -- stripe connect (never store card/customer data)
  stripe_account_id TEXT,
  stripe_connection_status TEXT NOT NULL DEFAULT 'NOT_CONNECTED'
    CHECK (stripe_connection_status IN ('NOT_CONNECTED', 'PENDING', 'CONNECTED')),

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_payment_settings_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- CLIENTS (reusable directory)
-- =========================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  client_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP,

  CONSTRAINT fk_client_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- INVOICES
-- =========================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,
  client_id UUID,

  type TEXT NOT NULL CHECK (type IN ('PRODUCT', 'SERVICE')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')),

  invoice_number TEXT NOT NULL,

  -- Denormalized client snapshot (kept even if the client record changes)
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_company TEXT,
  client_address TEXT,
  shipping_address TEXT,

  currency TEXT NOT NULL DEFAULT 'USD',

  -- Pricing inputs
  discount_type TEXT NOT NULL DEFAULT 'NONE'
    CHECK (discount_type IN ('NONE', 'PERCENTAGE', 'FIXED')),
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_type TEXT NOT NULL DEFAULT 'NONE'
    CHECK (tax_type IN ('NONE', 'GST', 'VAT', 'SALES', 'CUSTOM')),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,

  -- Computed money values (integer cents)
  subtotal INT NOT NULL CHECK (subtotal >= 0),
  discount_amount INT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount INT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_amount INT NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  handling_amount INT NOT NULL DEFAULT 0 CHECK (handling_amount >= 0),
  round_off INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL CHECK (total_amount >= 0),

  payment_method TEXT CHECK (
    payment_method IN ('CASH', 'COD', 'BANK_TRANSFER', 'ONLINE', 'UPI', 'CARD')
  ),
  payment_provider TEXT,
  payment_details JSONB,
  payment_terms TEXT,

  notes TEXT,
  terms TEXT,

  issue_date TIMESTAMP,
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  pdf_url TEXT,

  sent_at TIMESTAMP,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP,

  CONSTRAINT fk_invoice_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT fk_invoice_client
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,

  CONSTRAINT unique_invoice_per_user
    UNIQUE (user_id, invoice_number)
);

-- =========================
-- INVOICE ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  invoice_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit TEXT,
  unit_price INT NOT NULL CHECK (unit_price >= 0),
  discount INT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax INT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total_price INT NOT NULL CHECK (total_price >= 0),
  position INT,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- =========================
-- PAYMENTS (one per invoice)
-- =========================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  invoice_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,

  provider TEXT NOT NULL DEFAULT 'STRIPE' CHECK (provider IN ('STRIPE', 'MANUAL')),
  method TEXT CHECK (method IN ('CASH', 'COD', 'BANK_TRANSFER', 'ONLINE', 'UPI', 'CARD')),
  provider_payment_id TEXT UNIQUE,

  amount INT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),

  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_payment_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,

  CONSTRAINT fk_payment_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- AUDIT LOG
-- =========================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('INVOICE', 'PAYMENT', 'CLIENT', 'USER')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- =========================
-- PASSWORD RESETS
-- =========================
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);