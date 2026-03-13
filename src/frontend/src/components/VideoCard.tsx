import { useAuth } from "@/hooks/useAuth";
import {
  useIncrementViews,
  useLikeVideo,
  useUnlikeVideo,
} from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Video } from "../backend.d";

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  onCommentOpen: (videoId: bigint) => void;
  index: number;
}

export function VideoCard({
  video,
  isActive,
  onCommentOpen,
  index,
}: VideoCardProps) {
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(Number(video.likeCount));
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewsTracked = useRef(false);
  const videoId = video.id;
  const { isAuthenticated } = useAuth();
  const likeVideo = useLikeVideo();
  const unlikeVideo = useUnlikeVideo();
  const incrementViews = useIncrementViews();

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
      if (!viewsTracked.current) {
        viewsTracked.current = true;
        incrementViews.mutate(videoId);
      }
    } else {
      videoRef.current.pause();
    }
  }, [isActive, videoId, incrementViews]);

  const handleLike = () => {
    if (!isAuthenticated) return;
    if (liked) {
      setLiked(false);
      setLocalLikes((p) => p - 1);
      unlikeVideo.mutate(videoId);
    } else {
      setLiked(true);
      setLocalLikes((p) => p + 1);
      likeVideo.mutate(videoId);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: video.title, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const videoUrl = video.blobId.getDirectURL();
  const thumbnailUrl = video.thumbnailBlobId.getDirectURL();

  return (
    <div
      data-ocid={`feed.item.${index}`}
      className="relative w-full h-full bg-black flex items-center justify-center snap-start overflow-hidden"
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        loop
        muted={muted}
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 gradient-overlay pointer-events-none" />

      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className="absolute top-14 right-3 glass rounded-full p-2 z-10"
      >
        {muted ? (
          <VolumeX size={18} className="text-white" />
        ) : (
          <Volume2 size={18} className="text-white" />
        )}
      </button>

      {/* Right action bar */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-6 z-10">
        {/* Like */}
        <button
          type="button"
          data-ocid="video.like_button"
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={cn(
              "w-11 h-11 rounded-full glass flex items-center justify-center transition-all active:scale-90",
              liked && "bg-primary/20",
            )}
          >
            <Heart
              size={22}
              className={cn(
                "transition-all",
                liked ? "fill-primary text-primary" : "text-white",
              )}
            />
          </div>
          <span className="text-white text-xs font-semibold">
            {formatCount(localLikes)}
          </span>
        </button>

        {/* Comment */}
        <button
          type="button"
          data-ocid="video.comment_button"
          onClick={() => onCommentOpen(videoId)}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full glass flex items-center justify-center active:scale-90 transition-all">
            <MessageCircle size={22} className="text-white" />
          </div>
          <span className="text-white text-xs font-semibold">Comment</span>
        </button>

        {/* Share */}
        <button
          type="button"
          data-ocid="video.share_button"
          onClick={handleShare}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full glass flex items-center justify-center active:scale-90 transition-all">
            <Share2 size={22} className="text-white" />
          </div>
          <span className="text-white text-xs font-semibold">Share</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute left-0 right-16 bottom-24 px-4 z-10 space-y-2">
        <p className="text-white font-display font-bold text-base leading-tight line-clamp-2">
          {video.title}
        </p>
        <p className="text-white/70 text-sm line-clamp-2">
          {video.description}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {video.hashtags.map((tag) => (
            <span key={tag} className="text-primary text-sm font-semibold">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <Eye size={12} />
          <span>{formatCount(Number(video.viewCount))} views</span>
        </div>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
