# Vibeclip

## Current State
- Full-stack video sharing app with Internet Identity auth
- Feed, discover, upload, and profile pages
- Backend has role-based access: admin/user/guest via `_initializeAccessControlWithSecret`
- No welcome modal after login; no admin UI surfaces

## Requested Changes (Diff)

### Add
- `WelcomeModal` component: shows a branded welcome dialog after a user successfully logs in or signs up for the first time (when loginStatus transitions to "success")
- Admin badge on ProfilePage when `isCallerAdmin()` returns true
- Admin claim section in ProfilePage: a collapsible form to claim admin by entering the CAFFEINE_ADMIN_TOKEN secret via `_initializeAccessControlWithSecret`
- Admin controls: admins can delete any video (not just their own) — shown as a delete button on video cards when user is admin

### Modify
- `App.tsx`: track loginStatus changes to trigger welcome modal display; use localStorage key `vc_welcomed` to only show once per new login session
- `ProfilePage.tsx`: add admin badge and admin claim UI section
- `VideoCard.tsx` or `FeedPage.tsx`: show admin delete button when user is admin

### Remove
- Nothing removed

## Implementation Plan
1. Create `src/frontend/src/components/WelcomeModal.tsx` — Dialog with branding, welcome message, CTA to close
2. Update `App.tsx` — detect login success transition, set showWelcome state, render `<WelcomeModal>`
3. Update `ProfilePage.tsx` — query `isCallerAdmin`, show admin badge, add admin claim form (input for secret + button that calls `_initializeAccessControlWithSecret`)
4. Add admin video delete to `FeedPage.tsx` or `VideoCard.tsx` — if isAdmin, show delete button on any video
5. Validate and build
