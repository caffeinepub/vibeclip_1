// auth.mo — Vibe Clip Authentication Canister
// -----------------------------------------------
// Handles user registration, login sessions, and
// Internet Identity principal binding on ICP.
//
// Deploy alongside your main canister:
//   dfx deploy auth
//
// This canister stores:
//   - username → principal mappings
//   - session tokens
//   - ban status (synced with ban_manager.py via admin calls)

import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";

actor AuthCanister {

  // ─── TYPES ────────────────────────────────────────────────────────────────

  type UserId    = Nat;
  type Username  = Text;
  type SessionId = Text;

  type User = {
    id          : UserId;
    username    : Username;
    displayName : Text;
    principal   : Principal;
    createdAt   : Int;       // nanoseconds timestamp
    isBanned    : Bool;
    banReason   : ?Text;
    banExpiry   : ?Int;      // nanoseconds, null = permanent
  };

  type Session = {
    userId    : UserId;
    principal : Principal;
    createdAt : Int;
    expiresAt : Int;         // nanoseconds
  };

  type LoginResult = {
    #ok  : { sessionId : SessionId; user : PublicUser };
    #err : Text;
  };

  type RegisterResult = {
    #ok  : { sessionId : SessionId; user : PublicUser };
    #err : Text;
  };

  // Safe public-facing user (no sensitive internals)
  type PublicUser = {
    id          : UserId;
    username    : Username;
    displayName : Text;
    createdAt   : Int;
  };

  // ─── STATE ────────────────────────────────────────────────────────────────

  stable var nextUserId : UserId = 1;

  // principal text → User
  stable var userEntries : [(Text, User)] = [];
  var usersByPrincipal = HashMap.fromIter<Text, User>(
    userEntries.vals(), 16, Text.equal, Text.hash
  );

  // username (lowercase) → UserId
  stable var usernameEntries : [(Username, UserId)] = [];
  var usernameIndex = HashMap.fromIter<Username, UserId>(
    usernameEntries.vals(), 16, Text.equal, Text.hash
  );

  // sessionId → Session
  stable var sessionEntries : [(SessionId, Session)] = [];
  var sessions = HashMap.fromIter<SessionId, Session>(
    sessionEntries.vals(), 64, Text.equal, Text.hash
  );

  // Session lifetime: 30 days in nanoseconds
  let SESSION_TTL : Int = 30 * 24 * 60 * 60 * 1_000_000_000;

  // ─── SYSTEM HOOKS (stable upgrade) ────────────────────────────────────────

  system func preupgrade() {
    userEntries     := Iter.toArray(usersByPrincipal.entries());
    usernameEntries := Iter.toArray(usernameIndex.entries());
    sessionEntries  := Iter.toArray(sessions.entries());
  };

  system func postupgrade() {
    userEntries     := [];
    usernameEntries := [];
    sessionEntries  := [];
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  func now() : Int { Time.now() };

  func toPublicUser(u : User) : PublicUser = {
    id          = u.id;
    username    = u.username;
    displayName = u.displayName;
    createdAt   = u.createdAt;
  };

  func generateSessionId(p : Principal, ts : Int) : SessionId {
    // Simple deterministic session ID — in production consider crypto.rand
    let base = Principal.toText(p) # Int.toText(ts);
    Text.hash(base) |> Nat.toText(_) // pseudorandom enough for ICP
  };

  func isValidUsername(name : Text) : Bool {
    let chars = Text.toIter(name);
    var len = 0;
    for (c in chars) {
      let code = Nat32.toNat(Char.toNat32(c));
      // Allow a-z A-Z 0-9 _ -
      let ok = (code >= 48 and code <= 57)   // 0-9
            or (code >= 65 and code <= 90)   // A-Z
            or (code >= 97 and code <= 122)  // a-z
            or code == 95                    // _
            or code == 45;                   // -
      if (not ok) return false;
      len += 1;
    };
    len >= 3 and len <= 30
  };

  func isBanActive(user : User) : Bool {
    if (not user.isBanned) return false;
    switch (user.banExpiry) {
      case null    { true };  // permanent
      case (?exp)  { now() < exp };
    }
  };

  // ─── PUBLIC API ───────────────────────────────────────────────────────────

  /// Register a new user. Called after Internet Identity auth.
  /// The caller's Principal is automatically captured.
  public shared(msg) func register(username : Text, displayName : Text) : async RegisterResult {
    let caller = msg.caller;

    if (Principal.isAnonymous(caller)) {
      return #err("You must authenticate with Internet Identity before registering.");
    };

    let pText = Principal.toText(caller);

    // Already registered?
    switch (usersByPrincipal.get(pText)) {
      case (?existing) {
        if (isBanActive(existing)) {
          return #err("Your account is suspended. Reason: " # Option.get(existing.banReason, "policy violation"));
        };
        let sid = generateSessionId(caller, now());
        let session : Session = { userId = existing.id; principal = caller; createdAt = now(); expiresAt = now() + SESSION_TTL };
        sessions.put(sid, session);
        return #ok({ sessionId = sid; user = toPublicUser(existing) });
      };
      case null {};
    };

    // Username taken?
    let lowerName = Text.toLowercase(username);
    if (Option.isSome(usernameIndex.get(lowerName))) {
      return #err("Username '" # username # "' is already taken. Please choose another.");
    };

    if (not isValidUsername(username)) {
      return #err("Username must be 3–30 characters and contain only letters, numbers, _ or -");
    };

    // Create user
    let uid  = nextUserId;
    nextUserId += 1;

    let user : User = {
      id          = uid;
      username    = username;
      displayName = if (displayName == "") { username } else { displayName };
      principal   = caller;
      createdAt   = now();
      isBanned    = false;
      banReason   = null;
      banExpiry   = null;
    };

    usersByPrincipal.put(pText, user);
    usernameIndex.put(lowerName, uid);

    let sid = generateSessionId(caller, now());
    let session : Session = { userId = uid; principal = caller; createdAt = now(); expiresAt = now() + SESSION_TTL };
    sessions.put(sid, session);

    #ok({ sessionId = sid; user = toPublicUser(user) })
  };

  /// Login — called after Internet Identity auth each visit.
  public shared(msg) func login() : async LoginResult {
    let caller = msg.caller;

    if (Principal.isAnonymous(caller)) {
      return #err("Please authenticate with Internet Identity first.");
    };

    let pText = Principal.toText(caller);

    switch (usersByPrincipal.get(pText)) {
      case null {
        #err("No account found. Please register first.")
      };
      case (?user) {
        if (isBanActive(user)) {
          let reason = Option.get(user.banReason, "violation of community guidelines");
          return #err("Your account has been suspended: " # reason # ". Contact support to appeal.");
        };

        // Create fresh session
        let sid = generateSessionId(caller, now());
        let session : Session = { userId = user.id; principal = caller; createdAt = now(); expiresAt = now() + SESSION_TTL };
        sessions.put(sid, session);

        #ok({ sessionId = sid; user = toPublicUser(user) })
      };
    }
  };

  /// Validate a session (call from other canisters or frontend)
  public query func validateSession(sessionId : SessionId) : async ?PublicUser {
    switch (sessions.get(sessionId)) {
      case null { null };
      case (?s) {
        if (now() > s.expiresAt) { null }
        else {
          let pText = Principal.toText(s.principal);
          switch (usersByPrincipal.get(pText)) {
            case null    { null };
            case (?user) {
              if (isBanActive(user)) { null }
              else { ?toPublicUser(user) }
            };
          }
        }
      };
    }
  };

  /// Logout — invalidate session
  public shared func logout(sessionId : SessionId) : async Bool {
    switch (sessions.get(sessionId)) {
      case null  { false };
      case (?_)  { sessions.delete(sessionId); true };
    }
  };

  /// Get current user by principal (for other canisters)
  public shared(msg) func whoami() : async ?PublicUser {
    let pText = Principal.toText(msg.caller);
    switch (usersByPrincipal.get(pText)) {
      case null    { null };
      case (?user) {
        if (isBanActive(user)) { null }
        else { ?toPublicUser(user) }
      };
    }
  };

  // ─── ADMIN API (ban sync from ban_manager.py) ─────────────────────────────
  // These are called by your admin principal — lock these down in production
  // by checking msg.caller against a hardcoded admin principal.

  public shared(msg) func adminBanUser(userId : UserId, reason : Text, expiryNanos : ?Int) : async Bool {
    // TODO: add admin principal check:
    // assert(msg.caller == adminPrincipal);
    for ((pText, user) in usersByPrincipal.entries()) {
      if (user.id == userId) {
        let banned : User = {
          id          = user.id;
          username    = user.username;
          displayName = user.displayName;
          principal   = user.principal;
          createdAt   = user.createdAt;
          isBanned    = true;
          banReason   = ?reason;
          banExpiry   = expiryNanos;
        };
        usersByPrincipal.put(pText, banned);
        return true;
      };
    };
    false
  };

  public shared(msg) func adminUnbanUser(userId : UserId) : async Bool {
    for ((pText, user) in usersByPrincipal.entries()) {
      if (user.id == userId) {
        let unbanned : User = {
          id          = user.id;
          username    = user.username;
          displayName = user.displayName;
          principal   = user.principal;
          createdAt   = user.createdAt;
          isBanned    = false;
          banReason   = null;
          banExpiry   = null;
        };
        usersByPrincipal.put(pText, unbanned);
        return true;
      };
    };
    false
  };

  public query func getUserCount() : async Nat { usersByPrincipal.size() };
}
