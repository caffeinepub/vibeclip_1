# Vibeclip

## Current State
Admin claim via `claimAdminWithToken` calls `Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")` inside a shared function -- `system` capability is unavailable there, so the call either traps or returns null, making admin grant silently fail every time.

## Requested Changes (Diff)

### Add
- `grantAdminToUsername(username: Text, token: Text)` backend function: looks up a user profile by username and promotes them to admin if the token is correct.
- Admin token read at actor initialization (stored as `let adminToken`) so it is available in all shared functions.

### Modify
- Read `CAFFEINE_ADMIN_TOKEN` at actor init time (top-level `let`) instead of inside the shared function.
- `claimAdminWithToken` uses the stored `adminToken` value.
- Profile page: add a "Grant Admin by Username" field next to the existing admin claim, allowing the current user to type a username and promote them.

### Remove
- `Prim.envVar<system>` call inside `claimAdminWithToken` shared function.

## Implementation Plan
1. Fix `main.mo`: read env var at init, fix `claimAdminWithToken`, add `grantAdminToUsername`.
2. Update Profile page frontend to include a form that lets an admin (or token holder) grant admin to another user by username.
