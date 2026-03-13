import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExternalBlob } from "../backend";
import type { Comment, UserProfile, Video } from "../backend";
import { useActor } from "./useActor";

export function useVideosFeed(page = 0) {
  const { actor, isFetching } = useActor();
  return useQuery<Video[]>({
    queryKey: ["videos", "feed", page],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getVideosPaginated(BigInt(page * 10), BigInt(10));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useVideoById(id: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Video>({
    queryKey: ["video", id?.toString()],
    queryFn: async () => {
      if (!actor || id === null) throw new Error("No actor or id");
      return actor.getVideoById(id);
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}

export function useCommentsForVideo(videoId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Comment[]>({
    queryKey: ["comments", videoId?.toString()],
    queryFn: async () => {
      if (!actor || videoId === null) return [];
      return actor.getCommentsForVideo(videoId);
    },
    enabled: !!actor && !isFetching && videoId !== null,
  });
}

export function useCallerProfile() {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfile | null>({
    queryKey: ["profile", "caller"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUserProfile(principal: Principal | null) {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfile | null>({
    queryKey: ["profile", principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return null;
      return actor.getUserProfile(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useTrendingHashtags() {
  const { actor, isFetching } = useActor();
  return useQuery<[string, bigint][]>({
    queryKey: ["hashtags", "trending"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTrendingHashtags();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useVideosByHashtag(hashtag: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Video[]>({
    queryKey: ["videos", "hashtag", hashtag],
    queryFn: async () => {
      if (!actor || !hashtag) return [];
      return actor.getVideosByHashtag(hashtag);
    },
    enabled: !!actor && !isFetching && !!hashtag,
  });
}

export function useFollowerCount(principal: Principal | null) {
  const { actor, isFetching } = useActor();
  return useQuery<bigint>({
    queryKey: ["followers", principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return BigInt(0);
      return actor.getFollowerCount(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useFollowingCount(principal: Principal | null) {
  const { actor, isFetching } = useActor();
  return useQuery<bigint>({
    queryKey: ["following", principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return BigInt(0);
      return actor.getFollowingCount(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["admin", "isCallerAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useLikeVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: bigint) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.likeVideo(videoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

export function useUnlikeVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: bigint) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.unlikeVideo(videoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

export function useAddComment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      videoId,
      content,
    }: { videoId: bigint; content: string }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.addComment(videoId, content);
    },
    onSuccess: (_data, { videoId }) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", videoId.toString()],
      });
    },
  });
}

export function useUploadVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      title: string;
      description: string;
      hashtags: string[];
      blobId: ExternalBlob;
      thumbnailBlobId: ExternalBlob;
    }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.uploadVideo(
        params.title,
        params.description,
        params.hashtags,
        params.blobId,
        params.thumbnailBlobId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

export function useCreateOrUpdateProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      username: string;
      displayName: string;
      bio: string;
      avatarBlobId: ExternalBlob;
    }) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.createOrUpdateProfile(
        params.username,
        params.displayName,
        params.bio,
        params.avatarBlobId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useFollowUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.followUser(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

export function useUnfollowUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.unfollowUser(principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

export function useIncrementViews() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (videoId: bigint) => {
      if (!actor) return;
      return actor.incrementViews(videoId);
    },
  });
}

export function useDeleteVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: bigint) => {
      if (!actor) throw new Error("Not authenticated");
      return actor.deleteVideo(videoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

export function useClaimAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      if (!actor) throw new Error("Not authenticated");
      const granted = await actor.claimAdminWithToken(token);
      if (!granted) {
        throw new Error("Invalid admin token");
      }
      return granted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useGrantAdminToUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      token,
    }: { username: string; token: string }) => {
      if (!actor) throw new Error("Not authenticated");
      const granted = await actor.grantAdminToUsername(username, token);
      if (!granted) {
        throw new Error("Username not found or invalid token");
      }
      return granted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
