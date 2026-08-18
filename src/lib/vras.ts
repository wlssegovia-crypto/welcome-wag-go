export const CATEGORIES = [
  "RESIDENT",
  "EMPLOYEE",
  "STAFF",
  "WORKER",
  "GUEST",
  "TRANSIENT",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PROPERTY_TYPES = [
  "RESIDENTIAL_CONDO",
  "SUBDIVISION",
  "MIXED_USE",
  "OFFICE_TOWER",
  "MALL",
  "HOSPITAL",
  "SCHOOL",
  "DORMITORY",
  "FACTORY",
  "WAREHOUSE",
  "RESORT_HOTEL",
  "SPORTS_CLUB",
  "EMBASSY",
  "OTHER",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const ROLES = [
  "super_admin",
  "property_admin",
  "security_guard",
  "host_resident",
  "visitor",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  property_admin: "Property Admin",
  security_guard: "Security Guard",
  host_resident: "Host / Resident",
  visitor: "Visitor",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  RESIDENT: "Long-term resident / occupant",
  EMPLOYEE: "Employee",
  STAFF: "Staff",
  WORKER: "Contractor / worker",
  GUEST: "Short-term transient (hotel guest, patient, boarder)",
  TRANSIENT: "Day visitor / walk-in / delivery",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  RESIDENTIAL_CONDO: "Residential condominium",
  SUBDIVISION: "Subdivision / gated community",
  MIXED_USE: "Mixed-use development",
  OFFICE_TOWER: "Office building / tower",
  MALL: "Mall / retail",
  HOSPITAL: "Hospital / medical centre",
  SCHOOL: "School / university campus",
  DORMITORY: "Dormitory / student housing",
  FACTORY: "Factory / industrial plant",
  WAREHOUSE: "Warehouse / logistics hub",
  RESORT_HOTEL: "Hotel / resort",
  SPORTS_CLUB: "Sports club / golf course",
  EMBASSY: "Embassy / consulate",
  OTHER: "Other",
};


/** Mask a phone number for guard-facing logs: +63 917 555 1234 -> +63 •••• 1234 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 4) return "••••";
  return `${digits.slice(0, 3)}••••${digits.slice(-3)}`;
}

export function maskEmail(email?: string | null): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain || !name) return "••••";
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

/* ---------------------------------------------------------------------------
 * Rotating pass payload (anti-screenshot).
 * The stored qr_token is the long-lived secret; the QR itself encodes
 * `<token>.<slot>.<code>` where the code changes every ROTATION_SECONDS.
 * The gate accepts the current slot and the previous one (clock tolerance).
 * ------------------------------------------------------------------------- */
export const ROTATION_SECONDS = 30;

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0").slice(-7);
}

export function currentSlot(now: number = Date.now()): number {
  return Math.floor(now / 1000 / ROTATION_SECONDS);
}

export function rotatingCode(token: string, slot: number): string {
  return fnv1a(`${token}:${slot}`);
}

export function buildPassPayload(token: string, now: number = Date.now()): string {
  const slot = currentSlot(now);
  return `${token}.${slot}.${rotatingCode(token, slot)}`;
}

export function parsePassPayload(raw: string): { token: string; slot: number; code: string } | null {
  const parts = raw.trim().split(".");
  if (parts.length !== 3) return null;
  const slot = Number(parts[1]);
  if (!parts[0] || !Number.isFinite(slot) || !parts[2]) return null;
  return { token: parts[0], slot, code: parts[2] };
}

export function verifyPassPayload(raw: string, token: string, now: number = Date.now()): boolean {
  const parsed = parsePassPayload(raw);
  if (!parsed || parsed.token !== token) return false;
  const nowSlot = currentSlot(now);
  return [nowSlot, nowSlot - 1, nowSlot + 1].some(
    (slot) => parsed.slot === slot && parsed.code === rotatingCode(token, slot),
  );
}

export function randomCode(prefix: string, length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${prefix}${out}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
