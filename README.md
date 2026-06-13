# Sila Backend

Sila is a modular monolith marketplace backend built with NestJS, Fastify, PostgreSQL, and Prisma. The platform connects customers with service providers through Sila, without direct customer-to-provider communication.

Implemented service domains include Billboards / Outdoor Advertising and Exhibitions. The architecture is prepared for future service domains such as freelancers, marketing, and other marketplace verticals.

## Tech Stack

- NestJS
- Fastify
- TypeScript
- PostgreSQL
- Prisma
- JWT authentication
- Role-based access control
- Postman collection and environment
- Local file uploads for billboard images and exhibition maps

## Architecture Overview

Sila is organized as a clean, modular monolith that can be split into services later if needed.

- `src/shared`: shared and core modules used across service domains.
- `src/shared/auth`: JWT authentication, RBAC guards, decorators, and auth routes.
- `src/shared/users`: shared user management.
- `src/shared/companies`: shared company management.
- `src/shared/notifications`: internal notification foundation.
- `src/shared/database`: Prisma service, Prisma module, and reusable repository base.
- `src/shared/common`: common DTOs, interceptors, filters, and response utilities.
- `src/services`: business service domains.
- `src/services/billboards`: Billboards / Outdoor Advertising domain.
- `src/services/exhibitions`: Exhibitions domain with map-based booth management and booth booking requests.

The backend follows a Controller + Service + Repository pattern. Repositories can extend the shared `BaseRepository` for common Prisma operations.

## Prerequisites

- Node.js 20 or newer is recommended.
- pnpm
- PostgreSQL
- Postman, optional but recommended for testing the API collection.

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd sila-backend
```

Install dependencies:

```bash
pnpm install
```

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
```

## Environment Variables

Example `.env`:

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=*
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sila?schema=public
JWT_ACCESS_SECRET=change-me-access-secret-minimum-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-minimum-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
UPLOAD_ROOT=uploads
PUBLIC_BASE_URL=http://localhost:3000
MAX_UPLOAD_SIZE_MB=5
```

Use strong JWT secrets in real environments. Each JWT secret must be at least 32 characters.

## PostgreSQL Setup

Install and start PostgreSQL locally.

Create a database named `sila`:

```sql
CREATE DATABASE sila;
```

Update `DATABASE_URL` in `.env` with your PostgreSQL username, password, host, port, and database name.

Example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sila?schema=public
```

## Prisma Setup

Generate the Prisma client:

```bash
pnpm exec prisma generate
```

Run database migrations:

```bash
pnpm exec prisma migrate dev
```

Seed the default admin user:

```bash
pnpm seed
```

Default seed admin credentials:

```text
Email: admin@sila.local
Password: Admin123456!
```

## Running the Server

Start the development server:

```bash
pnpm start:dev
```

Health check:

```text
http://localhost:3000/api/v1/health
```

Expected response shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "status": "ok",
    "service": "sila-api",
    "timestamp": "2026-05-08T00:00:00.000Z"
  }
}
```

## Roles

`SUPER_ADMIN`

Platform admin. Can manage companies, users, billboards, road packages, offer monitoring/archive actions, notifications, and exhibition review actions. Exhibition and booking access is monitoring-only except for approving, rejecting, archiving, or soft-deleting exhibitions.

`COMPANY_ADMIN`

Partner/company user. Can manage only their own company billboards, road packages, offers, exhibitions, billboard media, exhibition maps, unavailable periods, booths, and approve or reject booking items assigned to their company. Company admins fully own exhibition content, map files, and booth management.

`CUSTOMER`

Customer user. Can browse public billboards, offers, and exhibitions, check availability, create multi-item booking requests, book exhibition booths, view their own bookings, and manage their own profile.

`INSTALLER`

Company installation staff user. Belongs to one company, logs in with normal JWT auth, sees only assigned billboard installation work, starts assignments, and uploads proof images after installation.

## Billboard Installation Workflow

The billboard installation workflow belongs to the Billboards / Outdoor Advertising domain only. It is implemented under `src/services/billboards` and does not affect exhibitions.

When a company admin approves a billboard booking item, the backend creates `BillboardInstallationUnit` records idempotently:

- `BILLBOARD`: one installation unit for the booked billboard.
- `ROAD_PACKAGE`: one installation unit for each underlying billboard in the package.
- `OFFER`: one installation unit for each underlying billboard in the offer.

Each installation unit represents one real billboard that needs its own customer creative. A customer who booked a package or offer must upload creative separately for every underlying billboard unit.

Customer creative endpoints:

- `GET /api/v1/customer/bookings/:bookingId/installation-units`
- `POST /api/v1/customer/installation-units/:unitId/creative/upload`
- `PATCH /api/v1/customer/installation-units/:unitId/creative`

Creative uploads use Fastify multipart, not multer. Files are stored under `uploads/billboards/creatives`. `creativeImage` supports JPEG, PNG, and WebP. `creativeFile` supports JPEG, PNG, WebP, and PDF. URL-based creative updates are also supported.

Company admin installer management:

- `POST /api/v1/partner/installers`
- `GET /api/v1/partner/installers`
- `GET /api/v1/partner/installers/:id`
- `PATCH /api/v1/partner/installers/:id`
- `DELETE /api/v1/partner/installers/:id`

Company admins can create active `INSTALLER` users only for their own company and only when the company has an active Billboards subscription.

Company admin installation review endpoints:

- `GET /api/v1/partner/installation-units`
- `GET /api/v1/partner/installation-units/:id`
- `POST /api/v1/partner/installation-units/:unitId/assignments`
- `PATCH /api/v1/partner/installation-units/:unitId/approve`
- `PATCH /api/v1/partner/installation-units/:unitId/request-revision`

Company admins assign one or more installers to a ready unit. After installers submit proof, the company admin approves the unit or requests revision with notes.

Installer dashboard endpoints:

- `GET /api/v1/installer/assignments`
- `GET /api/v1/installer/assignments/:id`
- `PATCH /api/v1/installer/assignments/:id/start`
- `POST /api/v1/installer/assignments/:id/evidence/upload`
- `POST /api/v1/installer/assignments/:id/evidence`

Installer proof uploads use Fastify multipart and are stored under `uploads/billboards/installations`. Installers can upload 1 to 10 JPEG, PNG, or WebP images. Installer responses include billboard details, booking IDs, creative URLs, and notes, but avoid customer private email and phone data.

## Main API Groups

- Auth
- Users
- Companies
- Partner Billboards
- Admin Billboards
- Public Billboards
- Public Offers
- Partner Exhibitions
- Admin Exhibitions
- Public Exhibitions
- Customer Exhibition Bookings
- Partner Exhibition Booking Items
- Admin Exhibition Bookings
- Availability
- Customer Bookings
- Partner Booking Items
- Partner Installers
- Customer Installation Units
- Partner Installation Units
- Installer Assignments
- Admin Bookings
- Notifications

## Postman Usage

Import the collection:

```text
postman/sila-api.postman_collection.json
```

Import the environment:

```text
postman/sila-local.postman_environment.json
```

Select the `Sila Local` environment in Postman.

Recommended testing flow:

1. Health
2. Super Admin Login
3. Create Company
4. Create Company Admin
5. Company Admin Login
6. Create Billboard
7. Upload/Add Media
8. Admin Approve Billboard
9. Public Billboard Browsing
10. Register Customer
11. Check Availability
12. Create Customer Booking
13. Create Exhibition
14. Upload Exhibition Map
15. Create Exhibition Booth or Bulk Booths
16. Confirm Map and Submit Exhibition
17. Admin Approve Exhibition
18. Public Exhibition Browsing
19. Create Customer Exhibition Booking
20. Partner Approve/Reject Booking Items
21. Admin Monitor Bookings
22. Notifications

The Postman collection stores common IDs and tokens automatically when possible, including access tokens, refresh tokens, company IDs, billboard IDs, exhibition IDs, exhibition booth IDs, booking request IDs, exhibition booking IDs, and notification IDs.

## Media Uploads

Billboard media supports both URL-based media and local file upload.

URL-based partner media endpoint:

```text
POST /api/v1/partner/billboards/:id/media
```

Local upload endpoints:

```text
POST /api/v1/partner/billboards/:id/media/upload
POST /api/v1/admin/billboards/:id/media/upload
```

Upload request format:

```text
multipart/form-data
file: image file
isMain: optional boolean
sortOrder: optional number
```

Allowed image MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`

Uploaded files are stored under:

```text
uploads/billboards
```

Public file URL format:

```text
http://localhost:3000/uploads/billboards/<filename>
```

Uploaded files are ignored by Git. Placeholder `.gitkeep` files keep the upload directories present in the repository.

## Exhibitions

The Exhibitions service lets partner companies create exhibitions, upload a plan/map image or PDF, place booth shapes on top of the map, and submit the exhibition for super-admin approval.

Exhibition map files support URL-based fields and local Fastify multipart upload. Local map files are stored under:

```text
uploads/exhibitions/maps
```

Public map file URL format:

```text
http://localhost:3000/uploads/exhibitions/maps/<filename>
```

Public approved exhibition maps can also be requested through explicit download endpoints:

```text
GET /api/v1/public/exhibitions/:slug/map/image
GET /api/v1/public/exhibitions/:slug/map/pdf
GET /api/v1/public/exhibitions/:slug/map/download
```

Use `/map/image` when the frontend needs an image for interactive booth overlays, `/map/pdf` when the UI needs the PDF version, and `/map/download` for a general download/open action. The general endpoint redirects to the PDF when available, otherwise to the image. These endpoints are public but only work for approved, non-deleted exhibitions owned by active companies with an active Exhibitions subscription.

Interactive map booth coordinates are stored as percentage-based JSON points. The frontend can draw `RECTANGLE` or `POLYGON` booth shapes over the map using those coordinates.

Booths may optionally belong to an exhibition sector. Sectors are organizational metadata for grouping and filtering booths; customer bookings are still made on individual booths.

Company admins manage exhibition booths through single-booth APIs and bulk APIs for large exhibition maps:

```text
POST /api/v1/partner/exhibitions/:id/booths/bulk
PATCH /api/v1/partner/exhibitions/:id/booths/bulk
DELETE /api/v1/partner/exhibitions/:id/booths/bulk
```

Bulk booth requests accept up to 200 booths or booth IDs per request and run in a transaction. Booths do not require admin approval and do not have an approval/rejection workflow.

Exhibitions support both `heroImageUrl` and `secondaryHeroImageUrl` for public presentation, plus map image/PDF files for booth layout interactions.

Super admins can review exhibitions, approve or reject submissions, archive exhibitions, monitor booths, and soft-delete exhibitions. They do not create, edit, delete, price, assign sectors, or upload map files for booths or exhibition content. Deleting an exhibition marks the exhibition and its booths as deleted, while preserving booking records and uploaded files for audit/history.

Exhibition booth booking is request-based. Customers can request one or many available booths from an approved public exhibition. Partner companies approve or reject individual booth booking items; approval marks the booth as `BOOKED`, while rejection keeps it `AVAILABLE`. Admin exhibition booking endpoints are monitoring-only.

`BOOKED` booths cannot be deleted. Company admins may update only descriptive booth fields on booked booths: title, description, color, area, and sort order. Geometry, coordinates, price, setup price, currency, sector, code, and status cannot be changed once a booth is booked.

## Booking Notes

- Booking does not include payment yet.
- Booking is request-based, not direct payment booking.
- Customer bookings can contain individual billboards, road packages, and offers.
- `customerCompanyScope` is required for customer billboard and exhibition bookings. `LOCAL` uses `localPrice`; `INTERNATIONAL` uses `internationalPrice`.
- Customer exhibition bookings can contain one or many exhibition booths.
- Partner companies approve or reject only their own booking items.
- Admin booking endpoints are monitoring-only.
- Public billboard browsing is open.
- Creating bookings requires authenticated `CUSTOMER` access.
- Approved booking items and unavailable periods block future availability.
- Partners cannot see customer email or phone in partner booking item responses.
- Exhibition partner booking item responses also hide customer email and phone.

## Pricing Rules

- Billboards and exhibition booths use `localPrice` and `internationalPrice`; the legacy `price` field remains only for backward compatibility.
- PRINTED billboard final scoped prices are computed from printed components. `FLEX` uses `localFlexPrice` / `internationalFlexPrice` directly. `STANDARD` uses flex price plus `localStandardAddedValue` / `internationalStandardAddedValue`. The computed final `localPrice` / `internationalPrice` values are stored and used by public search, offers, road-package booking, and billboard booking.
- Public billboard `minPrice` / `maxPrice` filters match either scoped price.
- Road packages and offers are booked as one logical booking item, while availability still checks the underlying billboards.
- Offer original totals are calculated separately for local and international billboard prices. Partner offer create/update accepts `localDiscountedTotalPrice` and `internationalDiscountedTotalPrice`.
- Offers no longer require admin approval. Partner-created offers become `APPROVED` immediately when all included billboards are approved, and public offer visibility still depends on approved status plus the offer date range.
- DIGITAL billboards may include `displayDurationSeconds`; that field is invalid for non-digital billboards.
- `pricingUnit: HOUR` remains valid only for `CAR_AD`, and `printedSubtype` remains valid only for `PRINTED`.
- Exhibition booths may include `setupPrice`. Customer exhibition booking uses the selected scoped booth price plus `setupPrice`, and booking items snapshot both the selected final price and setup price.

## Useful Scripts

```bash
pnpm start
pnpm start:dev
pnpm start:debug
pnpm start:prod
pnpm build
pnpm format
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:cov
pnpm seed
```

Common Prisma commands:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm exec prisma studio
```

## Troubleshooting

### Prisma P1001 Cannot Reach Database

Check that PostgreSQL is running and that `DATABASE_URL` points to the correct host, port, database, username, and password.

Also confirm the database exists:

```sql
CREATE DATABASE sila;
```

### Missing JWT Environment Variables

If the app fails during startup because JWT config is missing, check:

```env
JWT_ACCESS_SECRET=change-me-access-secret-minimum-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-minimum-32-chars
```

Both values must be present and at least 32 characters.

### PowerShell pnpm.ps1 Execution Policy

If PowerShell blocks `pnpm` with an execution policy error, run commands through `cmd`:

```powershell
cmd /c pnpm start:dev
cmd /c pnpm build
cmd /c pnpm exec prisma migrate dev
```

Alternatively, adjust your PowerShell execution policy according to your local development policy.

### Port 3000 Already in Use

Either stop the process using port `3000`, or change the port in `.env`:

```env
PORT=3001
```

Then restart the server and use:

```text
http://localhost:3001/api/v1/health
```

### Uploaded Files Are Not Loading

Check these values:

```env
UPLOAD_ROOT=uploads
PUBLIC_BASE_URL=http://localhost:3000
```

Make sure the server is running and the file exists under:

```text
uploads/billboards
uploads/exhibitions/maps
```

## Project Status

Implemented foundation includes authentication, RBAC, companies, company admin users, billboard management, exhibition management, media/map uploads, public browsing, availability, customer booking requests, booth booking requests, and internal notifications.

Not implemented yet:

- Payments
- Email/SMS notifications
- S3/MinIO storage
- Public provider contact
- Additional service domains beyond billboards and exhibitions
