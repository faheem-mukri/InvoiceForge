# InvoiceForge

Invoice-first invoicing system with support for:

- Guest invoice generation (no login, no persistence)
- Authenticated invoice management with history
- Product invoices (printable, delivery-box friendly)
- Service invoices (email-first, online payment optional)

This project is under active development.
Architecture-first, backend-focused.

Domain Concepts:
- User
- Guest
- Invoice
- Invoice Item
- Payment

## Features

- User authentication (JWT-based)
- Protected APIs
- Draft invoice creation (product & service)
- PostgreSQL-backed relational data model

## API Overview

### Auth
- POST /auth/register
- POST /auth/login

### Invoices
- POST /invoices (create draft invoice, auth required)


### Authentication

All protected endpoints require an Authorization header:

Authorization: Bearer <access_token>
