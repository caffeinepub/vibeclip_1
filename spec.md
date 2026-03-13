# Vibeclip

## Current State
- Profile update fails because users are never registered in the access control system
- Admin claim broken for same reason
- deleteVideo only allows uploader to delete, not admin
- Backend data stored in non-stable Maps, lost on canister upgrade

## Requested Changes (Diff)

### Add
- Auto-register user after login
- Stable storage for all backend data

### Modify
- deleteVideo: allow admin to delete any video
- App.tsx: call registration after login

### Remove
- Nothing

## Implementation Plan
1. Update main.mo: stable vars, preupgrade/postupgrade, fix deleteVideo
2. Update App.tsx: auto-register on login
