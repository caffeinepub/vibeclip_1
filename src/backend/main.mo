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
  stable var nextVideoId = 1;
  stable var nextCommentId = 1;

  // Storage
  let videos = Map.empty<Nat, Video>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let comments = Map.empty<Nat, Comment>();
  let followers = Map.empty<Principal, Set.Set<Principal>>();
  let following = Map.empty<Principal, Set.Set<Principal>>();
  let videoLikes = Map.empty<Nat, Set.Set<Principal>>();
  let hashtagVideos = Map.empty<Text, Set.Set<Nat>>();

  // Stable storage for persistence across upgrades
  stable var stableVideos : [(Nat, Video)] = [];
  stable var stableProfiles : [(Principal, UserProfile)] = [];
  stable var stableComments : [(Nat, Comment)] = [];

  system func preupgrade() {
    stableVideos := videos.entries().toArray();
    stableProfiles := userProfiles.entries().toArray();
    stableComments := comments.entries().toArray();
  };

  system func postupgrade() {
    for ((k, v) in stableVideos.values()) {
      videos.add(k, v);
    };
    for ((k, v) in stableProfiles.values()) {
      userProfiles.add(k, v);
    };
    for ((k, v) in stableComments.values()) {
      comments.add(k, v);
    };
    stableVideos := [];
    stableProfiles := [];
    stableComments := [];
  };

  // Modules
  module Video {
    public func compare(video1 : Video, video2 : Video) : Order.Order {
      Nat.compare(video1.id, video2.id);
    };
  };

  module Comment {
    public func compare(comment1 : Comment, comment2 : Comment) : Order.Order {
      Nat.compare(comment1.id, comment2.id);
    };
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Auto-register the caller as a user (safe to call multiple times)
  public shared ({ caller }) func registerUser() : async () {
    AccessControl.registerUser(accessControlState, caller);
  };

  // Required profile functions for frontend
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    // Auto-register then save
    AccessControl.registerUser(accessControlState, caller);
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func uploadVideo(title : Text, description : Text, hashtags : [Text], blobId : Storage.ExternalBlob, thumbnailBlobId : Storage.ExternalBlob) : async Nat {
    // Auto-register then check permission
    AccessControl.registerUser(accessControlState, caller);
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

    for (hashtag in hashtags.values()) {
      let existing = switch (hashtagVideos.get(hashtag)) {
        case (null) {
          let newSet = Set.singleton<Nat>(videoId);
          hashtagVideos.add(hashtag, newSet);
          newSet;
        };
        case (?set) {
          set.add(videoId);
          set;
        };
      };
    };
    videoId;
  };

  public query ({ caller }) func getVideosPaginated(start : Nat, pageSize : Nat) : async [Video] {
    let videoArray = videos.values().toArray().sort();
    let videoList = List.empty<Video>();
    var count = 0;
    var i = if (videoArray.size() > start) { start } else { videoArray.size() };
    while (i < videoArray.size() and count < pageSize) {
      videoList.add(videoArray[i]);
      i += 1;
      count += 1;
    };
    videoList.toArray();
  };

  public query ({ caller }) func getVideoById(id : Nat) : async Video {
    switch (videos.get(id)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) { video };
    };
  };

  public shared ({ caller }) func likeVideo(videoId : Nat) : async () {
    AccessControl.registerUser(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?_) {
        let likes = switch (videoLikes.get(videoId)) {
          case (null) {
            let newSet = Set.singleton(caller);
            videoLikes.add(videoId, newSet);
            newSet;
          };
          case (?set) {
            set.add(caller);
            set;
          };
        };
        updateLikeCount(videoId, likes);
      };
    };
  };

  public shared ({ caller }) func unlikeVideo(videoId : Nat) : async () {
    AccessControl.registerUser(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?_) {
        let likes = switch (videoLikes.get(videoId)) {
          case (null) {
            let newSet = Set.empty<Principal>();
            videoLikes.add(videoId, newSet);
            newSet;
          };
          case (?set) {
            set.remove(caller);
            set;
          };
        };
        updateLikeCount(videoId, likes);
      };
    };
  };

  public shared ({ caller }) func incrementViews(videoId : Nat) : async () {
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) {
        let updatedVideo = {
          video with
          viewCount = video.viewCount + 1;
        };
        videos.add(videoId, updatedVideo);
      };
    };
  };

  public shared ({ caller }) func deleteVideo(videoId : Nat) : async () {
    AccessControl.registerUser(accessControlState, caller);
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) {
        // Allow admin OR uploader to delete
        if (video.uploader != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only uploader or admin can delete video");
        };
        videos.remove(videoId);
      };
    };
  };

  public shared ({ caller }) func addComment(videoId : Nat, content : Text) : async Nat {
    AccessControl.registerUser(accessControlState, caller);
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
    let commentList = List.empty<Comment>();
    for ((_, comment) in comments.entries()) {
      if (comment.videoId == videoId) {
        commentList.add(comment);
      };
    };
    commentList.toArray().sort();
  };

  public shared ({ caller }) func deleteComment(commentId : Nat) : async () {
    AccessControl.registerUser(accessControlState, caller);
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
    AccessControl.registerUser(accessControlState, caller);
    let profile : UserProfile = {
      principal = caller;
      username;
      displayName;
      bio;
      avatarBlobId;
    };
    userProfiles.add(caller, profile);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    userProfiles.get(user);
  };

  public shared ({ caller }) func followUser(userToFollow : Principal) : async () {
    AccessControl.registerUser(accessControlState, caller);
    let followersSet = switch (followers.get(userToFollow)) {
      case (null) {
        let newSet = Set.singleton(caller);
        followers.add(userToFollow, newSet);
        newSet;
      };
      case (?set) {
        set.add(caller);
        set;
      };
    };

    let followingSet = switch (following.get(caller)) {
      case (null) {
        let newSet = Set.singleton(userToFollow);
        following.add(caller, newSet);
        newSet;
      };
      case (?set) {
        set.add(userToFollow);
        set;
      };
    };
  };

  public shared ({ caller }) func unfollowUser(userToUnfollow : Principal) : async () {
    AccessControl.registerUser(accessControlState, caller);
    let followersSet = switch (followers.get(userToUnfollow)) {
      case (null) {
        let newSet = Set.empty<Principal>();
        followers.add(userToUnfollow, newSet);
        newSet;
      };
      case (?set) {
        set.remove(caller);
        set;
      };
    };

    let followingSet = switch (following.get(caller)) {
      case (null) {
        let newSet = Set.empty<Principal>();
        following.add(caller, newSet);
        newSet;
      };
      case (?set) {
        set.remove(userToUnfollow);
        set;
      };
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
      for (hashtag in video.hashtags.values()) {
        let currentCount = switch (counts.get(hashtag)) {
          case (null) { 0 };
          case (?count) { count };
        };
        counts.add(hashtag, currentCount + 1);
      };
    };

    let entries = counts.entries().toArray();
    if (entries.size() == 0) {
      return [];
    };

    entries;
  };

  public query ({ caller }) func getVideosByHashtag(hashtag : Text) : async [Video] {
    let videoList = List.empty<Video>();
    switch (hashtagVideos.get(hashtag)) {
      case (null) { return [] };
      case (?set) {
        for (id in set.values()) {
          if (videos.containsKey(id)) {
            let video = switch (videos.get(id)) {
              case (null) { Runtime.trap("Video not found") };
              case (?video) { video };
            };
            videoList.add(video);
          };
        };
      };
    };
    videoList.toArray();
  };

  func updateLikeCount(videoId : Nat, likes : Set.Set<Principal>) {
    switch (videos.get(videoId)) {
      case (null) { Runtime.trap("Video not found") };
      case (?video) {
        let updatedVideo = {
          video with
          likeCount = likes.size();
        };
        videos.add(videoId, updatedVideo);
      };
    };
  };
};
