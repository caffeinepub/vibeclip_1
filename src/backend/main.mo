import Map "mo:core/Map";
import Set "mo:core/Set";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Order "mo:core/Order";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Prim "mo:prim";

import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import MixinStorage "blob-storage/Mixin";
import AccessControl "authorization/access-control";

actor {
  include MixinStorage();

  // Types
  public type Video = {
    id : Nat;
    uploader : Principal;
    title : Text;
    description : Text;
    hashtags : [Text];
    timestamp : Time.Time;
    viewCount : Nat;
    likeCount : Nat;
    blobId : Storage.ExternalBlob;
    thumbnailBlobId : Storage.ExternalBlob;
  };

  public type UserProfile = {
    principal : Principal;
    username : Text;
    displayName : Text;
    bio : Text;
    avatarBlobId : Storage.ExternalBlob;
  };

  public type Comment = {
    id : Nat;
    videoId : Nat;
    author : Principal;
    content : Text;
    timestamp : Time.Time;
  };

  // ID counters
  var nextVideoId = 1;
  var nextCommentId = 1;

  // Storage
  let videos = Map.empty<Nat, Video>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let comments = Map.empty<Nat, Comment>();
  let followers = Map.empty<Principal, Set.Set<Principal>>();
  let following = Map.empty<Principal, Set.Set<Principal>>();
  let videoLikes = Map.empty<Nat, Set.Set<Principal>>();
  let hashtagVideos = Map.empty<Text, Set.Set<Nat>>();

  // Stable storage for persistence across upgrades
  stable var stableNextVideoId : Nat = 1;
  stable var stableNextCommentId : Nat = 1;
  stable var stableVideos : [(Nat, Video)] = [];
  stable var stableProfiles : [(Principal, UserProfile)] = [];
  stable var stableComments : [(Nat, Comment)] = [];

  system func preupgrade() {
    stableNextVideoId := nextVideoId;
    stableNextCommentId := nextCommentId;
    stableVideos := videos.entries().toArray();
    stableProfiles := userProfiles.entries().toArray();
    stableComments := comments.entries().toArray();
  };

  system func postupgrade() {
    nextVideoId := stableNextVideoId;
    nextCommentId := stableNextCommentId;
    for ((k, v) in stableVideos.vals()) {
      videos.add(k, v);
    };
    for ((k, v) in stableProfiles.vals()) {
      userProfiles.add(k, v);
    };
    for ((k, v) in stableComments.vals()) {
      comments.add(k, v);
    };
    stableVideos := [];
    stableProfiles := [];
    stableComments := [];
  };

  func compareVideos(v1 : Video, v2 : Video) : Order.Order {
    Nat.compare(v1.id, v2.id);
  };

  func compareComments(c1 : Comment, c2 : Comment) : Order.Order {
    Nat.compare(c1.id, c2.id);
  };

  // Helper: auto-register a non-anonymous caller as a user if not already registered
  func autoRegister(state : AccessControl.AccessControlState, caller : Principal) {
    if (caller.isAnonymous()) { return };
    switch (state.userRoles.get(caller)) {
      case (?_) {}; // already registered
      case (null) { state.userRoles.add(caller, #user) };
    };
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Auto-register the caller as a user (safe to call multiple times)
  public shared ({ caller }) func registerUser() : async () {
    autoRegister(accessControlState, caller);
  };

  // Claim admin role with the correct admin token
  public shared ({ caller }) func claimAdminWithToken(token : Text) : async Bool {
    if (caller.isAnonymous()) { return false };
    switch (Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")) {
      case (null) {
        Runtime.trap("CAFFEINE_ADMIN_TOKEN environment variable is not set");
      };
      case (?adminToken) {
        if (token != adminToken) { return false };
        // Promote caller to admin regardless of current role
        accessControlState.userRoles.add(caller, #admin);
        accessControlState.adminAssigned := true;
        return true;
      };
    };
  };

  // Required profile functions for frontend
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    autoRegister(accessControlState, caller);
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func uploadVideo(title : Text, description : Text, hashtags : [Text], blobId : Storage.ExternalBlob, thumbnailBlobId : Storage.ExternalBlob) : async Nat {
    autoRegister(accessControlState, caller);
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upload videos");
    };

    let videoId = nextVideoId;
    nextVideoId += 1;

    let video : Video = {
      id = videoId;
      uploader = caller;
      title;
      description;
      hashtags;
      timestamp = Time.now();
      viewCount = 0;
      likeCount = 0;
      blobId;
      thumbnailBlobId;
    };

    videos.add(videoId, video);

    for (hashtag in hashtags.vals()) {
      switch (hashtagVideos.get(hashtag)) {
        case (null) { hashtagVideos.add(hashtag, Set.singleton<Nat>(videoId)) };
        case (?set) { set.add(videoId) };
      };
    };
    videoId;
  };

  public query ({ caller }) func getVideosPaginated(start : Nat, pageSize : Nat) : async [Video] {
    let rawVideos = videos.values().toArray();
    let sorted = rawVideos.sort(compareVideos);
    let total = sorted.size();
    let from = if (start < total) { start } else { total };
    let to_ = if (from + pageSize < total) { from + pageSize } else { total };
    sorted.sliceToArray(from, to_);
  };

  public query ({ caller }) func getVideoById(id : Nat) : async Video {
    switch (videos.get(id)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) { video };
    };
  };

  public shared ({ caller }) func likeVideo(videoId : Nat) : async () {
    autoRegister(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?_) {
        switch (videoLikes.get(videoId)) {
          case (null) { videoLikes.add(videoId, Set.singleton(caller)) };
          case (?set) { set.add(caller) };
        };
        updateLikeCount(videoId);
      };
    };
  };

  public shared ({ caller }) func unlikeVideo(videoId : Nat) : async () {
    autoRegister(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?_) {
        switch (videoLikes.get(videoId)) {
          case (null) {};
          case (?set) { set.remove(caller) };
        };
        updateLikeCount(videoId);
      };
    };
  };

  public shared ({ caller }) func incrementViews(videoId : Nat) : async () {
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) {
        videos.add(videoId, { video with viewCount = video.viewCount + 1 });
      };
    };
  };

  public shared ({ caller }) func deleteVideo(videoId : Nat) : async () {
    autoRegister(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) {
        if (video.uploader != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only uploader or admin can delete video");
        };
        videos.remove(videoId);
      };
    };
  };

  public shared ({ caller }) func addComment(videoId : Nat, content : Text) : async Nat {
    autoRegister(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?_) {
        let commentId = nextCommentId;
        nextCommentId += 1;
        let comment : Comment = {
          id = commentId;
          videoId;
          author = caller;
          content;
          timestamp = Time.now();
        };
        comments.add(commentId, comment);
        commentId;
      };
    };
  };

  public query ({ caller }) func getCommentsForVideo(videoId : Nat) : async [Comment] {
    let filtered = List.empty<Comment>();
    for ((_, comment) in comments.entries()) {
      if (comment.videoId == videoId) { filtered.add(comment) };
    };
    let arr = filtered.toArray();
    arr.sort(compareComments);
  };

  public shared ({ caller }) func deleteComment(commentId : Nat) : async () {
    autoRegister(accessControlState, caller);
    switch (comments.get(commentId)) {
      case (null) { Runtime.trap("Comment not found") };
      case (?comment) {
        if (comment.author != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only author or admin can delete comment");
        };
        comments.remove(commentId);
      };
    };
  };

  public shared ({ caller }) func createOrUpdateProfile(username : Text, displayName : Text, bio : Text, avatarBlobId : Storage.ExternalBlob) : async () {
    autoRegister(accessControlState, caller);
    userProfiles.add(caller, {
      principal = caller;
      username;
      displayName;
      bio;
      avatarBlobId;
    });
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    userProfiles.get(user);
  };

  public shared ({ caller }) func followUser(userToFollow : Principal) : async () {
    autoRegister(accessControlState, caller);
    switch (followers.get(userToFollow)) {
      case (null) { followers.add(userToFollow, Set.singleton(caller)) };
      case (?set) { set.add(caller) };
    };
    switch (following.get(caller)) {
      case (null) { following.add(caller, Set.singleton(userToFollow)) };
      case (?set) { set.add(userToFollow) };
    };
  };

  public shared ({ caller }) func unfollowUser(userToUnfollow : Principal) : async () {
    autoRegister(accessControlState, caller);
    switch (followers.get(userToUnfollow)) {
      case (null) {};
      case (?set) { set.remove(caller) };
    };
    switch (following.get(caller)) {
      case (null) {};
      case (?set) { set.remove(userToUnfollow) };
    };
  };

  public query ({ caller }) func getFollowerCount(user : Principal) : async Nat {
    switch (followers.get(user)) {
      case (null) { 0 };
      case (?set) { set.size() };
    };
  };

  public query ({ caller }) func getFollowingCount(user : Principal) : async Nat {
    switch (following.get(user)) {
      case (null) { 0 };
      case (?set) { set.size() };
    };
  };

  public query ({ caller }) func isFollowing(user : Principal, target : Principal) : async Bool {
    switch (following.get(user)) {
      case (null) { false };
      case (?set) { set.contains(target) };
    };
  };

  public query ({ caller }) func getTrendingHashtags() : async [(Text, Nat)] {
    let counts = Map.empty<Text, Nat>();
    for ((_, video) in videos.entries()) {
      for (hashtag in video.hashtags.vals()) {
        let current = switch (counts.get(hashtag)) {
          case (null) { 0 };
          case (?n) { n };
        };
        counts.add(hashtag, current + 1);
      };
    };
    counts.entries().toArray();
  };

  public query ({ caller }) func getVideosByHashtag(hashtag : Text) : async [Video] {
    switch (hashtagVideos.get(hashtag)) {
      case (null) { [] };
      case (?set) {
        let result = List.empty<Video>();
        for (id in set.values()) {
          switch (videos.get(id)) {
            case (null) {};
            case (?video) { result.add(video) };
          };
        };
        result.toArray();
      };
    };
  };

  func updateLikeCount(videoId : Nat) {
    let count = switch (videoLikes.get(videoId)) {
      case (null) { 0 };
      case (?set) { set.size() };
    };
    switch (videos.get(videoId)) {
      case (null) {};
      case (?video) {
        videos.add(videoId, { video with likeCount = count });
      };
    };
  };
};
