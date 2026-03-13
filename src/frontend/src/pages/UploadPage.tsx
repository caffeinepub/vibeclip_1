import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useUploadVideo } from "@/hooks/useQueries";
import { ArrowLeft, Film, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";

interface UploadPageProps {
  onNavigate: (path: string) => void;
}

export function UploadPage({ onNavigate }: UploadPageProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const uploadVideo = useUploadVideo();
  const { isAuthenticated, login } = useAuth();

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const fileToBytes = (file: File): Promise<Uint8Array<ArrayBuffer>> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        resolve(new Uint8Array(e.target!.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    if (!title.trim() || !videoFile || !thumbnailFile) {
      toast.error(
        "Please fill all required fields and select video + thumbnail",
      );
      return;
    }

    setIsUploading(true);
    try {
      const [videoBytes, thumbBytes] = await Promise.all([
        fileToBytes(videoFile),
        fileToBytes(thumbnailFile),
      ]);

      const videoBlobId = ExternalBlob.fromBytes(videoBytes).withUploadProgress(
        (p) => setVideoProgress(p),
      );
      const thumbnailBlobId = ExternalBlob.fromBytes(
        thumbBytes,
      ).withUploadProgress((p) => setThumbnailProgress(p));

      const tags = hashtags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      await uploadVideo.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        hashtags: tags,
        blobId: videoBlobId,
        thumbnailBlobId,
      });

      toast.success("Video uploaded! 🐸");
      onNavigate("/");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
        <button
          type="button"
          onClick={() => onNavigate("/")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Upload Clip</h1>
        <span className="ml-auto text-xl">🐸</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-32">
        {/* Video drop zone */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Video *</Label>
          <label
            data-ocid="upload.dropzone"
            htmlFor="video-file-input"
            className="relative rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer overflow-hidden bg-card block"
          >
            {videoPreview ? (
              <div className="relative">
                <video
                  src={videoPreview}
                  className="w-full h-48 object-cover"
                  muted
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setVideoFile(null);
                    setVideoPreview(null);
                    setVideoProgress(0);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Film size={22} className="text-primary" />
                </div>
                <p className="text-sm font-medium">Tap to select video</p>
                <p className="text-xs text-muted-foreground">
                  MP4, MOV, AVI up to 100MB
                </p>
              </div>
            )}
          </label>
          <input
            ref={videoInputRef}
            id="video-file-input"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoSelect}
          />
          {isUploading && videoProgress > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading video...</span>
                <span>{Math.round(videoProgress)}%</span>
              </div>
              <Progress value={videoProgress} className="h-1.5" />
            </div>
          )}
        </div>

        {/* Thumbnail */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Thumbnail *
          </Label>
          <label
            data-ocid="upload.upload_button"
            htmlFor="thumbnail-file-input"
            className="relative rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer overflow-hidden bg-card block"
          >
            {thumbnailPreview ? (
              <div className="relative">
                <img
                  src={thumbnailPreview}
                  className="w-full h-36 object-cover"
                  alt="Thumbnail preview"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setThumbnailFile(null);
                    setThumbnailPreview(null);
                    setThumbnailProgress(0);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ImageIcon size={22} className="text-primary" />
                </div>
                <p className="text-sm font-medium">Select thumbnail</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP</p>
              </div>
            )}
          </label>
          <input
            ref={thumbnailInputRef}
            id="thumbnail-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailSelect}
          />
          {isUploading && thumbnailProgress > 0 && (
            <div className="mt-2">
              <Progress value={thumbnailProgress} className="h-1.5" />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title" className="text-sm font-semibold mb-2 block">
            Title *
          </Label>
          <Input
            id="title"
            data-ocid="upload.input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your clip a catchy title..."
            className="bg-secondary border-0"
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="desc" className="text-sm font-semibold mb-2 block">
            Description
          </Label>
          <Textarea
            id="desc"
            data-ocid="upload.textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about your clip..."
            className="bg-secondary border-0 resize-none"
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Hashtags */}
        <div>
          <Label htmlFor="tags" className="text-sm font-semibold mb-2 block">
            Hashtags
          </Label>
          <Input
            id="tags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="funny, viral, trending (comma separated)"
            className="bg-secondary border-0"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Separate with commas, e.g. funny, cats, viral
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 glass border-t border-border">
        <Button
          type="button"
          data-ocid="upload.submit_button"
          onClick={handleSubmit}
          disabled={
            isUploading || !title.trim() || !videoFile || !thumbnailFile
          }
          className="w-full h-12 text-base font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity neon-glow"
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={18} className="mr-2" />
              Post Clip
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
