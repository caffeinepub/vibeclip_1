import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Video {
    id: bigint;
    title: string;
    likeCount: bigint;
    hashtags: Array<string>;
    thumbnailBlobId: ExternalBlob;
    description: string;
    viewCount: bigint;
    timestamp: Time;
    blobId: ExternalBlob;
    uploader: Principal;
}
export type Time = bigint;
export interface Comment {
    id: bigint;
    content: string;
    author: Principal;
    timestamp: Time;
    videoId: bigint;
}
export interface UserProfile {
    bio: string;
    principal: Principal;
    username: string;
    displayName: string;
    avatarBlobId: ExternalBlob;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addComment(videoId: bigint, content: string): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createOrUpdateProfile(username: string, displayName: string, bio: string, avatarBlobId: ExternalBlob): Promise<void>;
    deleteComment(commentId: bigint): Promise<void>;
    deleteVideo(videoId: bigint): Promise<void>;
    followUser(userToFollow: Principal): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCommentsForVideo(videoId: bigint): Promise<Array<Comment>>;
    getFollowerCount(user: Principal): Promise<bigint>;
    getFollowingCount(user: Principal): Promise<bigint>;
    getTrendingHashtags(): Promise<Array<[string, bigint]>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVideoById(id: bigint): Promise<Video>;
    getVideosByHashtag(hashtag: string): Promise<Array<Video>>;
    getVideosPaginated(start: bigint, pageSize: bigint): Promise<Array<Video>>;
    incrementViews(videoId: bigint): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    isFollowing(user: Principal, target: Principal): Promise<boolean>;
    likeVideo(videoId: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    unfollowUser(userToUnfollow: Principal): Promise<void>;
    unlikeVideo(videoId: bigint): Promise<void>;
    uploadVideo(title: string, description: string, hashtags: Array<string>, blobId: ExternalBlob, thumbnailBlobId: ExternalBlob): Promise<bigint>;
}
