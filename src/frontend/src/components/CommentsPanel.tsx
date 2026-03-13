import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAddComment, useCommentsForVideo } from "@/hooks/useQueries";
import { Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CommentsPanelProps {
  videoId: bigint | null;
  onClose: () => void;
}

export function CommentsPanel({ videoId, onClose }: CommentsPanelProps) {
  const [text, setText] = useState("");
  const { isAuthenticated } = useAuth();
  const { data: comments, isLoading } = useCommentsForVideo(videoId);
  const addComment = useAddComment();

  const handleSubmit = async () => {
    if (!text.trim() || !videoId) return;
    try {
      await addComment.mutateAsync({ videoId, content: text.trim() });
      setText("");
      toast.success("Comment posted!");
    } catch {
      toast.error("Failed to post comment");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <section
        className="glass border-t border-border rounded-t-2xl max-h-[70vh] flex flex-col animate-slide-up"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        data-ocid="video.dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <h3 className="font-display font-bold text-base">Comments</h3>
          <button
            type="button"
            data-ocid="video.close_button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : comments && comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id.toString()} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  🐸
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {comment.author.toString().slice(0, 12)}...
                  </p>
                  <p className="text-sm">{comment.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm">No comments yet. Be first!</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-6 pt-3 border-t border-border flex gap-2">
          {isAuthenticated ? (
            <>
              <Input
                data-ocid="video.input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-secondary border-0"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                type="button"
                data-ocid="video.submit_button"
                onClick={handleSubmit}
                disabled={!text.trim() || addComment.isPending}
                size="icon"
                className="shrink-0"
              >
                <Send size={16} />
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm w-full text-center">
              Log in to comment
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
