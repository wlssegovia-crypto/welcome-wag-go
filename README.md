# GatePass Pro

# SYSTEM PROMPT: VISITOR & RESIDENT ACCESS SYSTEM (VRAS)

## 1. SYSTEM OVERVIEW & ARCHITECTURE GOALS
You are tasked with building a production-ready, full-stack, multi-tenant **Visitor and Resident Access System (VRAS)**. The system must be dynamic, fully configurable by property administrators, and optimized for high-throughput gate operations, self-service kiosks, and mobile resident portals.

### Core Architecture Requirements
- **Framework:** Next.js (App Router) / React / TypeScript
- **Styling & UI:** Tailwind CSS, Lucide Icons, Shadcn UI / Radix primitives
- **Database & ORM:** PostgreSQL / SQLite with Prisma ORM
- **State & Offline Engine:** React Query / Zustand + IndexedDB (Local-First Offline Sync Engine)
- **Real-Time Layer:** WebSockets (Pusher or Socket.io) for instantaneous guard and host notifications
- **PWA Capabilities:** Fully responsive Kiosk/Guard Mode and Mobile Resident Portal with camera & scanner integration

---

## 2. MULTI-CATEGORY FACILITY & USER MODEL

### A. Dynamic Property & Facility Configuration
The system MUST NOT be hardcoded to a single property type. Admin settings must allow toggling and naming facility zones (e.g., "Units", "Offices", "Lots", "Booths", "Rooms") across:
- **Residential:** Condominiums, Subdivisions, Gated Communities, Apartments, Dormitories.
- **Commercial & Corporate:** Office Towers, Tech Parks, Malls, Business Centers.
- **Institutional & Industrial:** Schools, Universities, Hospitals, Factories, Warehouses.
- **Hospitality & Leisure:** Hotels, Resorts, Sports Clubs, Golf Courses.

### B. Universal User Taxonomy
Implement granular access profiles, permissions, and credential rules for:
1. **Residents / Permanent Occupants** (Homeowners, Condo Unit Owners, Tenants)
2. **Employees / Internal Staff** (Corporate workers, Faculty, Facility Mgmt)
3. **Contractors / Maintenance Workers** (Vendors, Construction, Service Technicians)
4. **Pre-Approved Guests & Visitors** (Invited friends, family, registered attendees)
5. **Transients & Walk-ins** (Delivery riders, couriers, taxi/rideshare, day visitors)

---

## 3. KEY FUNCTIONAL MODULES

### 1. Digital Credentials & QR ID Generator
- **Exclusive Digital Passports:** Generate unique, dynamic QR ID cards/badges for residents, employees, and visitors.
- **Security Features:** Time-bound validity, dynamic TOTP/payload rotation (anti-screenshot protection), and visitor pass expiration dates.
- **Wallet & Sharing:** Export pass as Apple/Google Wallet cards, printable PDFs, or sharable web links/SMS.

### 2. Guard House & Gate Check-In/Out Station
- **Rapid Scanner Integration:** Native support for hardware USB/Bluetooth barcode & QR scanners, webcams, and tablet camera capture.
- **Physical ID OCR & Capture:** Camera snapshot feed to capture driver's licenses/national IDs with automatic text extraction (OCR).
- **Facial Verification:** Photo capture at check-in cross-referenced with pre-registered visitor/resident profiles.
- **UX & Audio Cues:** Large touch targets, high-contrast night mode UI, clear sound alerts (Success Green / Denial Red).

### 3. Hardware & Kiosk Integration
- Interface endpoints for self-service check-in tablets.
- Support for printing physical paper badges / thermal sticky passes upon gate approval.
- Web-RFID / NFC reader event listener support for physical card swiping.

### 4. Parcel & Delivery Management
- Guard logs incoming packages (Courier, Tracking #, Recipient, Photo of Parcel).
- Automated SMS/Push alert sent to host/recipient with a claim QR code.
- Verification on claim via QR scan or digital signature capture.

### 5. Host Notification System
- Instant push notifications, web alerts, or SMS sent to host when a visitor arrives at the gate/lobby.
- Host can click "Approve Entry" or "Deny Access" in real-time directly from their mobile portal.

### 6. Local-First Offline Mode & Sync Engine
- Local IndexedDB storage ensures check-ins and check-outs continue seamless operation during local internet outages.
- Background sync worker replays pending access logs to the cloud once connectivity is restored, with automatic conflict resolution.

### 7. Multi-Tenant Role-Based Access Control (RBAC)
- **Super Admin:** System-wide client management and platform analytics.
- **Property Admin:** Configures property layout, user categories, device policies, and custom access rules.
- **Gate / Security Guard:** Operates scanner interface, logs transients, manages gate activity feeds.
- **Host / Resident / Tenant:** Pre-registers guests, views personal visitor history, manages parcel pickups, presents personal digital QR ID.
- **Visitor / Transient:** Views read-only digital pass with navigation/directions to facility destination.

---

## 4. DATABASE SCHEMA BLUEPRINT (Prisma Schema Concept)

```prisma
enum PropertyType { RESIDENTIAL_CONDO, SUBDIVISION, OFFICE_TOWER, MALL, HOSPITAL, SCHOOL, FACTORY, RESORT_HOTEL, SPORTS_CLUB, OTHER }
enum UserRole { SUPER_ADMIN, PROPERTY_ADMIN, SECURITY_GUARD, HOST_RESIDENT, VISITOR }
enum CategoryType { RESIDENT, EMPLOYEE, WORKER, GUEST, TRANSIENT }
enum AccessStatus { GRANTED, DENIED, PENDING_HOST_APPROVAL, EXPIRED }

model Property {
  id           String       @id @default(uuid())
  name         String
  type         PropertyType
  address      String
  zones        Zone[]
  users        User[]
  accessLogs   AccessLog[]
  parcels      Parcel[]
  createdAt    DateTime     @default(now())
}

model Zone {
  id           String       @id @default(uuid())
  propertyId   String
  property     Property     @relation(fields: [propertyId], references: [id])
  name         String       // e.g., "Tower 1", "Phase 2", "Building B"
  units        Unit[]
}

model Unit {
  id           String       @id @default(uuid())
  zoneId       String
  zone         Zone         @relation(fields: [zoneId], references: [id])
  unitNumber   String       // e.g., "1004", "Lot 15", "Suite 300"
  occupants    User[]
  parcels      Parcel[]
}

model User {
  id           String       @id @default(uuid())
  propertyId   String
  property     Property     @relation(fields: [propertyId], references: [id])
  unitId       String?
  unit         Unit?        @relation(fields: [unitId], references: [id])
  role         UserRole     @default(HOST_RESIDENT)
  category     CategoryType @default(RESIDENT)
  fullName     String
  email        String?
  phone        String?
  photoUrl     String?
  qrPass       QrCredential?
  guestInvites GuestInvite[] @relation("HostInvites")
  accessLogs   AccessLog[]
  createdAt    DateTime     @default(now())
}

model QrCredential {
  id           String       @id @default(uuid())
  userId       String       @unique
  user         User         @relation(fields: [userId], references: [id])
  qrToken      String       @unique
  validFrom    DateTime
  validUntil   DateTime?
  isActive     Boolean      @default(true)
}

model GuestInvite {
  id           String       @id @default(uuid())
  hostId       String
  host         User         @relation("HostInvites", fields: [hostId], references: [id])
  guestName    String
  guestPhone   String?
  vehiclePlate String?
  accessCode   String       @unique
  validFrom    DateTime
  validUntil   DateTime
  isUsed       Boolean      @default(false)
}

model AccessLog {
  id           String       @id @default(uuid())
  propertyId   String
  property     Property     @relation(fields: [propertyId], references: [id])
  userId       String?
  user         User?        @relation(fields: [userId], references: [id])
  visitorName  String?
  category     CategoryType
  entryGate    String
  status       AccessStatus
  photoCaptured String?
  idDocumentUrl String?
  syncedFromOffline Boolean @default(false)
  timestamp    DateTime     @default(now())
}

model Parcel {
  id           String       @id @default(uuid())
  propertyId   String
  property     Property     @relation(fields: [propertyId], references: [id])
  unitId       String
  unit         Unit         @relation(fields: [unitId], references: [id])
  courierName  String
  trackingNo   String?
  photoUrl     String?
  status       String       @default("PENDING") // PENDING, CLAIMED
  claimedAt    DateTime?
  createdAt    DateTime     @default(now())
}

5. UI/UX PAGE BREAKDOWN TO GENERATE

​/dashboard/admin: Property configuration (Property Type selection, zone/unit batch setup, guard accounts, custom user categories, compliance settings).

​/gate/terminal: High-speed security station UI featuring live camera feed, scan input field listener, visitor check-in modal, photo capture, and audio alert triggers.

​/portal/resident: Mobile-first dashboard for residents/employees showing their personal QR ID card, guest pre-registration form, incoming parcel alerts, and real-time gate entry approval prompts.

​/kiosk/self-checkin: Clean kiosk interface for walk-in visitors to select host/unit, take a photo, scan physical ID, and wait for gate approval.

​/analytics/audit: Real-time log table with filters (Category, Date Range, Gate, Status), PDF/CSV exporter, and offline sync indicator.

​6. INSTRUCTIONS FOR THE AI CODE GENERATOR

​Begin by setting up the directory structure, Prisma schema, and base mock database seed scripts.

​Ensure all forms use robust client/server validation (Zod + React Hook Form).

 ​Include hotkey event listeners on the Gate Terminal (Enter to submit scan, Space to open camera capture).

​Ensure data privacy mechanisms are respected (mask personal phone numbers/emails in guard logs).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://welcome-wag-go.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f4bf2c8-d840-4a29-8014-9baf254a9d67).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
