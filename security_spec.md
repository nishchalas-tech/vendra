# Vendra Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Ownership (`userId` / `ownerId`)**: Every `/users/{userId}/private/profile` document can only be read, created, or updated by `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Mission Isolation**: Every `/missions/{missionId}` document must have `ownerId == request.auth.uid`. List queries on `/missions` must filter by `resource.data.ownerId == request.auth.uid`.
3. **Immutable Identity & Creation Timestamps**: `uid`, `ownerId`, `id`, and `createdAt` cannot be modified during `update`.
4. **Server Timestamps**: `createdAt` on `create` and `updatedAt` on `create`/`update` must equal `request.time`.
5. **Terminal State Locking**: Once a mission reaches `COMPLETED` or `CANCELLED`, subsequent client updates are rejected.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Read**: `auth = null` reading `/missions/m_1` -> `PERMISSION_DENIED`
2. **Unverified Email Write**: `auth.token.email_verified = false` creating `/missions/m_1` -> `PERMISSION_DENIED`
3. **Cross-User PII Read**: `auth.uid = "user_b"` reading `/users/user_a/private/profile` -> `PERMISSION_DENIED`
4. **Identity Spoofing on Mission Create**: `auth.uid = "user_a"` creating `/missions/m_1` with `ownerId: "user_b"` -> `PERMISSION_DENIED`
5. **Shadow Field Injection on Create**: Adding `"isAdmin": true` to `/missions/m_1` -> `PERMISSION_DENIED`
6. **Shadow Field Injection on Update**: Updating `/missions/m_1` with `"hacked": "yes"` -> `PERMISSION_DENIED`
7. **Owner Mutation on Update**: Changing `ownerId` on `/missions/m_1` -> `PERMISSION_DENIED`
8. **CreatedAt Mutation on Update**: Changing `createdAt` on `/missions/m_1` -> `PERMISSION_DENIED`
9. **Client Timestamp Forgery**: Setting `updatedAt` to a past/future timestamp instead of `request.time` -> `PERMISSION_DENIED`
10. **Terminal State Modification**: Updating `/missions/m_1` when `existing().state == "COMPLETED"` -> `PERMISSION_DENIED`
11. **Oversized String DoW Attack**: Setting `mission_name` to a 5,000-character string (`> 200`) -> `PERMISSION_DENIED`
12. **Unfiltered Collection Scraping**: Listing `/missions` without `ownerId == request.auth.uid` constraint -> `PERMISSION_DENIED`

## 3. Red Team Conflict Report
- **Identity Spoofing**: Blocked via `data.ownerId == request.auth.uid` and `incoming().ownerId == existing().ownerId`.
- **State Shortcutting / Terminal State**: Blocked via `!(existing().state in ['COMPLETED', 'CANCELLED'])`.
- **Resource Poisoning**: Blocked via `isValidId()` regex `^[a-zA-Z0-9_\-]+$` and `.size() <= 128`, plus strict `.size()` bounds on all strings.
- **Value Poisoning**: Blocked because `isValidUserProfile(incoming())` and `isValidMissionSync(incoming())` wrap the entire `allow update` expression.
