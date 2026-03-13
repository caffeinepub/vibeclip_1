import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrendingHashtags, useVideosByHashtag } from "@/hooks/useQueries";
import { Hash, Search, TrendingUp, X } from "lucide-react";
import { useState } from "react";

interface DiscoverPageProps {
  onNavigate: (path: string) => void;
}

export function DiscoverPage({ onNavigate: _onNavigate }: DiscoverPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const { data: trendingTags, isLoading: tagsLoading } = useTrendingHashtags();
  const { data: hashtagVideos, isLoading: videosLoading } =
    useVideosByHashtag(activeHashtag);

  const filteredTags =
    trendingTags?.filter((t) =>
      searchQuery
        ? t[0].toLowerCase().includes(searchQuery.toLowerCase())
        : true,
    ) ?? [];

  const SKELETON_IDS = ["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"];
  const SKELETON_LIST_IDS = [
    "ls1",
    "ls2",
    "ls3",
    "ls4",
    "ls5",
    "ls6",
    "ls7",
    "ls8",
  ];

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🐸</span>
          <h1 className="font-display font-bold text-xl">Discover</h1>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-ocid="discover.search_input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hashtags..."
            className="pl-9 bg-secondary border-0 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Active hashtag videos */}
      {activeHashtag && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveHashtag(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <Badge
              variant="secondary"
              className="bg-primary/20 text-primary border-primary/30"
            >
              #{activeHashtag}
            </Badge>
          </div>
          {videosLoading ? (
            <div className="grid grid-cols-3 gap-0.5">
              {SKELETON_IDS.map((id) => (
                <Skeleton key={id} className="aspect-[9/16]" />
              ))}
            </div>
          ) : hashtagVideos && hashtagVideos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5 pb-24">
              {hashtagVideos.map((video, i) => (
                <div
                  key={video.id.toString()}
                  data-ocid={`discover.item.${i + 1}`}
                  className="relative aspect-[9/16] bg-muted overflow-hidden cursor-pointer"
                >
                  <img
                    src={video.thumbnailBlobId.getDirectURL()}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 gradient-overlay p-2">
                    <p className="text-white text-[10px] font-medium truncate">
                      {video.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div data-ocid="discover.empty_state" className="text-center py-12">
              <p className="text-muted-foreground">
                No videos for #{activeHashtag}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trending hashtags */}
      {!activeHashtag && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <h2 className="font-display font-semibold text-base">Trending</h2>
          </div>

          {tagsLoading ? (
            <div className="space-y-3">
              {SKELETON_LIST_IDS.map((id) => (
                <div key={id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTags.length > 0 ? (
            <div className="space-y-1 pb-24">
              {filteredTags.map(([tag, count], i) => (
                <button
                  type="button"
                  key={tag}
                  data-ocid={`discover.item.${i + 1}`}
                  onClick={() => setActiveHashtag(tag)}
                  className="w-full flex items-center justify-between px-3 py-3.5 rounded-xl hover:bg-card transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Hash size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">#{tag}</p>
                      <p className="text-muted-foreground text-xs">
                        {count.toString()} videos
                      </p>
                    </div>
                  </div>
                  <TrendingUp size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div data-ocid="discover.empty_state" className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No hashtags matching "${searchQuery}"`
                  : "No trending hashtags yet"}
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1">
                Upload a video with hashtags to get started!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
