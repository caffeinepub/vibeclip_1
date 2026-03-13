import { CommentsPanel } from "@/components/CommentsPanel";
import { VideoCard } from "@/components/VideoCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useVideosFeed } from "@/hooks/useQueries";
import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface FeedPageProps {
  onNavigate: (path: string) => void;
}

export function FeedPage({ onNavigate }: FeedPageProps) {
  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [commentVideoId, setCommentVideoId] = useState<bigint | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: videos, isLoading } = useVideosFeed(0);
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const height = container.clientHeight;
      const idx = Math.round(scrollTop / height);
      setActiveVideoIndex(idx);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐸</span>
          <span className="font-display font-bold text-lg tracking-tight text-primary neon-text-glow">
            vibeclip
          </span>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            data-ocid="feed.for_you_tab"
            onClick={() => setActiveTab("foryou")}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "foryou"
                ? "text-foreground border-b-2 border-primary pb-0.5"
                : "text-muted-foreground"
            }`}
          >
            For You
          </button>
          <button
            type="button"
            data-ocid="feed.following_tab"
            onClick={() => {
              if (!isAuthenticated) {
                login();
                return;
              }
              setActiveTab("following");
            }}
            className={`text-sm font-semibold transition-colors ${
              activeTab === "following"
                ? "text-foreground border-b-2 border-primary pb-0.5"
                : "text-muted-foreground"
            }`}
          >
            Following
          </button>
        </div>
        {!isAuthenticated && (
          <button
            type="button"
            onClick={login}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            <LogIn size={13} />
            Login
          </button>
        )}
      </div>

      {/* Video feed */}
      {isLoading ? (
        <div className="w-full h-full bg-black">
          <Skeleton className="w-full h-full" data-ocid="feed.loading_state" />
        </div>
      ) : !videos || videos.length === 0 ? (
        <div
          data-ocid="feed.empty_state"
          className="w-full h-full flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
        >
          <div className="text-6xl">🐸</div>
          <h2 className="font-display font-bold text-2xl">No videos yet!</h2>
          <p className="text-muted-foreground text-sm">
            Be the first to upload a clip and start the vibe!
          </p>
          <button
            type="button"
            onClick={() => onNavigate("/upload")}
            className="mt-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity neon-glow"
          >
            Upload First Video
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="w-full h-full overflow-y-scroll snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {videos.map((video, i) => (
            <div
              key={video.id.toString()}
              className="h-full w-full"
              style={{ scrollSnapAlign: "start" }}
            >
              <VideoCard
                video={video}
                isActive={i === activeVideoIndex}
                onCommentOpen={(id) => setCommentVideoId(id)}
                index={i + 1}
              />
            </div>
          ))}
        </div>
      )}

      {/* Comments panel */}
      {commentVideoId !== null && (
        <CommentsPanel
          videoId={commentVideoId}
          onClose={() => setCommentVideoId(null)}
        />
      )}
    </div>
  );
}
