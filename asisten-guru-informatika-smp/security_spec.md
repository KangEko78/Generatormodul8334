# Security Specification

## Data Invariants
1. A user profile (`/users/{userId}`) can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid` matches the `userId`.
2. A Modul Ajar (`/users/{userId}/moduls/{modulId}`) can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid` matches the `userId`.
3. All write operations require a verified email (`request.auth.token.email_verified == true`).
4. Values must comply with maximum size and length constraints (e.g. Modul Ajar content is a string with maximum length of 100,000 characters).

## The "Dirty Dozen" Payloads (Designed to break laws of Identity, Integrity, and State)
Here are 12 malicious payloads that should be rejected by the security rules:

1. **Email Spoofing (UserProfile Create)**: Setting or updating a profile when email is not verified.
2. **Identity Spoofing (UserProfile Create)**: Creating a profile for a different `userId` than the authenticated user.
3. **Ghost Field Injection (UserProfile Update)**: Trying to inject a field not allowed by the schema (e.g. `isAdmin: true`).
4. **Length Overflow (UserProfile Create)**: Supplying a `namaSekolah` field longer than 150 characters.
5. **No Auth Access (UserProfile Read)**: Accessing profile document without being signed in.
6. **Cross-User Modul Read (ModulAjar Read)**: Reading another user's modul document.
7. **Identity Spoofing (ModulAjar Create)**: Creating a modul document inside another user's subcollection.
8. **Invalid Grade Enum (ModulAjar Create)**: Creating a modul with an invalid grade like `"X"` (must be `"VII"`, `"VIII"`, or `"IX"`).
9. **Content Size Exhaustion (ModulAjar Create)**: Creating a modul with `content` string exceeding 100,000 characters.
10. **Ghost Field on Modul (ModulAjar Create)**: Creating a modul with unapproved fields like `ratingCount`.
11. **Immutability Breach (ModulAjar Update)**: Attempting to update `id` or `createdAt` after creation.
12. **ID Poisoning (ModulAjar Get)**: Fetching a document with an extremely long invalid ID string.

## Test Specs
All of these payloads will fail with `PERMISSION_DENIED` in the Firestore Security Rules.
