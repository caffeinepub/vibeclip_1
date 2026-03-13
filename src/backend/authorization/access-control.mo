import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

module {
  public type UserRole = {
    #admin;
    #user;
    #guest;
  };

  public type AccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, UserRole>;
  };

  public func initState() : AccessControlState {
    {
      var adminAssigned = false;
      userRoles = Map.empty<Principal, UserRole>();
    };
  };

  // Claim admin with a secret token, or register as a regular user.
  // If the correct token is provided, the caller is always promoted to admin
  // regardless of whether they were previously registered as a user.
  public func initialize(state : AccessControlState, caller : Principal, adminToken : Text, userProvidedToken : Text) {
    if (caller.isAnonymous()) { return };
    if (userProvidedToken == adminToken) {
      // Correct token: promote to admin unconditionally
      state.userRoles.add(caller, #admin);
      state.adminAssigned := true;
    } else {
      // Wrong token: only register as user if not already registered
      switch (state.userRoles.get(caller)) {
        case (?_) {};
        case (null) { state.userRoles.add(caller, #user) };
      };
    };
  };

  public func registerUser(state : AccessControlState, caller : Principal) {
    if (caller.isAnonymous()) { return };
    switch (state.userRoles.get(caller)) {
      case (?_) {}; // Already registered, don't downgrade
      case (null) { state.userRoles.add(caller, #user) };
    };
  };

  public func getUserRole(state : AccessControlState, caller : Principal) : UserRole {
    if (caller.isAnonymous()) { return #guest };
    switch (state.userRoles.get(caller)) {
      case (?role) { role };
      case (null) { #guest };
    };
  };

  public func assignRole(state : AccessControlState, caller : Principal, user : Principal, role : UserRole) {
    if (not (isAdmin(state, caller))) {
      Runtime.trap("Unauthorized: Only admins can assign user roles");
    };
    state.userRoles.add(user, role);
  };

  public func hasPermission(state : AccessControlState, caller : Principal, requiredRole : UserRole) : Bool {
    let userRole = getUserRole(state, caller);
    if (userRole == #admin or requiredRole == #guest) { true } else {
      userRole == requiredRole;
    };
  };

  public func isAdmin(state : AccessControlState, caller : Principal) : Bool {
    getUserRole(state, caller) == #admin;
  };
};
