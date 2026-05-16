# Security Specification - Restaurant Captain App

## Data Invariants
1. A user document must match the authenticated UID.
2. Orders must be linked to a valid captain (auth user).
3. Tables can only be managed by staff (captains/admin/owner).
4. Menu and Categories can only be modified by admins or owners.
5. Roles are strictly hierarchical: Owner > Admin > Captain.

## The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Creating a user document with a different `uid` than `request.auth.uid`.
2. **Privilege Escalation**: A `captain` trying to update their own `role` to `admin` or `owner`.
3. **Orphaned Order**: Creating an order without a `captainId`.
4. **Invalid Order State**: Updating an order status from `completed` to `pending`.
5. **Table Hijacking**: A non-staff user updating table status.
6. **Price Tampering**: A `captain` updating the `price` of a `MenuItem`.
7. **Unauthorized List**: A `captain` attempting to list all `users` (PII exposure).
8. **Shadow Field**: Adding a `isVerified: true` field to a user profile during registration.
9. **Invalid ID**: Using a 1MB string as a `tableId`.
10. **Timestamp Manipulation**: Providing a custom `createdAt` timestamp instead of `serverTimestamp()`.
11. **PII Leak**: A guest user reading another user's private info.
12. **Status Skipping**: Moving an order from `pending` to `completed` without going through `running`.

## Implementation Strategy
- Use `isOwner()`, `isAdmin()`, `isCaptain()` helpers.
- Use `isValid[Entity]()` for all writes.
- Enforce strict key checks with `affectedKeys().hasOnly()` for updates.
- Protect PII in `users` collection.
