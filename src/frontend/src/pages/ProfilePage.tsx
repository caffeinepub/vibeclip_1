import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  useCallerProfile,
  useClaimAdmin,
  useCreateOrUpdateProfile,
  useDeleteVideo,
  useFollowerCount,
  useFollowingCount,
  useGrantAdminToUsername,
  useIsCallerAdmin,
  useVideosFeed,
} from "@/hooks/useQueries";
import {
  ChevronDown,
  ChevronUp,
  LogOut,
  Play,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";

interface ProfilePageProps {
  onNavigate: (path: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { isAuthenticated, login, logout, principal } = useAuth();
  const { data: profile, isLoading: profileLoading } = useCallerProfile();
  const { data: videos, isLoading: videosLoading } = useVideosFeed(0);
  const { data: followerCount } = useFollowerCount(principal);
  const { data: followingCount } = useFollowingCount(principal);
  const { data: isAdmin, refetch: refetchAdmin } = useIsCallerAdmin();
  const createOrUpdateProfile = useCreateOrUpdateProfile();
  const deleteVideo = useDeleteVideo();
  const claimAdmin = useClaimAdmin();
  const grantAdminToUsername = useGrantAdminToUsername();

  const [editOpen, setEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");

  const [adminExpanded, setAdminExpanded] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  // Grant admin to another user by username
  const [grantExpanded, setGrantExpanded] = useState(false);
  const [grantUsername, setGrantUsername] = useState("");
  const [grantToken, setGrantToken] = useState("");

  const userVideos =
    videos?.filter(
      (v) => principal && v.uploader.toString() === principal.toString(),
    ) ?? [];

  const handleEditOpen = () => {
    setEditUsername(profile?.username ?? "");
    setEditDisplayName(profile?.displayName ?? "");
    setEditBio(profile?.bio ?? "");
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      const avatarBlob = ExternalBlob.fromBytes(new Uint8Array(0));
      await createOrUpdateProfile.mutateAsync({
        username: editUsername,
        displayName: editDisplayName,
        bio: editBio,
        avatarBlobId: avatarBlob,
      });
      toast.success("Profile updated!");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update profile");
    }
  };

  const handleClaimAdmin = async () => {
    try {
      await claimAdmin.mutateAsync(adminToken);
      toast.success("Admin access granted!");
      setAdminToken("");
      setAdminExpanded(false);
      await refetchAdmin();
    } catch {
      toast.error("Invalid admin token. Please try again.");
    }
  };

  const handleGrantAdminToUsername = async () => {
    try {
      await grantAdminToUsername.mutateAsync({
        username: grantUsername.trim(),
        token: grantToken,
      });
      toast.success(`Admin granted to @${grantUsername.trim()}!`);
      setGrantUsername("");
      setGrantToken("");
      setGrantExpanded(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
    }
  };

  const handleDeleteVideo = async (videoId: bigint) => {
    try {
      await deleteVideo.mutateAsync(videoId);
      toast.success("Video deleted.");
    } catch {
      toast.error("Failed to delete video");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-6 px-8 text-center bg-background">
        <div className="text-6xl">🐸</div>
        <h2 className="font-display font-bold text-2xl">Join Vibeclip</h2>
        <p className="text-muted-foreground text-sm">
          Log in to create your profile, upload clips, and follow creators.
        </p>
        <Button
          type="button"
          onClick={login}
          className="w-full max-w-xs h-12 text-base font-bold rounded-xl bg-primary text-primary-foreground neon-glow"
        >
          Login
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="font-display font-bold text-xl">Profile</h1>
        <div className="flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                data-ocid="profile.edit_button"
                variant="ghost"
                size="icon"
                onClick={handleEditOpen}
              >
                <Settings size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="bg-card border-border"
              data-ocid="profile.dialog"
            >
              <DialogHeader>
                <DialogTitle className="font-display">Edit Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-semibold">Username</Label>
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="mt-1.5 bg-secondary border-0"
                    placeholder="@username"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Display Name</Label>
                  <Input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="mt-1.5 bg-secondary border-0"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Bio</Label>
                  <Textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="mt-1.5 bg-secondary border-0 resize-none"
                    placeholder="Tell the world about yourself..."
                    rows={3}
                  />
                </div>
                <Button
                  type="button"
                  data-ocid="profile.save_button"
                  onClick={handleSaveProfile}
                  disabled={createOrUpdateProfile.isPending}
                  className="w-full bg-primary text-primary-foreground font-bold"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button type="button" variant="ghost" size="icon" onClick={logout}>
            <LogOut size={20} />
          </Button>
        </div>
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4">
        {profileLoading ? (
          <div className="flex gap-4 items-center">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-2 border-primary">
                <AvatarFallback className="bg-primary/20 text-3xl">
                  {profile?.displayName?.[0]?.toUpperCase() ?? "🐸"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-xl">
                    {profile?.displayName || "Anonymous Frog"}
                  </h2>
                  {isAdmin && (
                    <span
                      data-ocid="profile.toggle"
                      className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded neon-glow"
                    >
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  @{profile?.username || principal?.toString().slice(0, 8)}
                </p>
                {profile?.bio && (
                  <p className="text-sm mt-1 text-foreground/80">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-5">
              <div className="text-center">
                <p className="font-display font-bold text-xl">
                  {userVideos.length}
                </p>
                <p className="text-muted-foreground text-xs">Videos</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">
                  {followerCount?.toString() ?? "0"}
                </p>
                <p className="text-muted-foreground text-xs">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">
                  {followingCount?.toString() ?? "0"}
                </p>
                <p className="text-muted-foreground text-xs">Following</p>
              </div>
            </div>

            {/* Admin claim section - only when NOT already admin */}
            {!isAdmin && (
              <div className="mt-4">
                <button
                  type="button"
                  data-ocid="profile.secondary_button"
                  onClick={() => setAdminExpanded((v) => !v)}
                  className="flex items-center gap-1 text-muted-foreground/60 text-xs hover:text-muted-foreground transition-colors"
                >
                  Admin Setup
                  {adminExpanded ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>
                {adminExpanded && (
                  <div className="mt-2 p-3 bg-secondary/40 rounded-lg space-y-2 border border-border/30">
                    <p className="text-xs text-muted-foreground">
                      Enter your admin secret token to claim admin access.
                    </p>
                    <Input
                      type="password"
                      data-ocid="profile.input"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="Enter admin token"
                      className="bg-secondary border-0 text-sm h-9"
                    />
                    <Button
                      type="button"
                      data-ocid="profile.submit_button"
                      onClick={handleClaimAdmin}
                      disabled={claimAdmin.isPending || !adminToken.trim()}
                      size="sm"
                      className="w-full bg-primary text-primary-foreground font-semibold"
                    >
                      {claimAdmin.isPending ? "Claiming..." : "Claim Admin"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Grant admin to another user by username (visible to anyone with the token) */}
            <div className="mt-3">
              <button
                type="button"
                data-ocid="profile.panel"
                onClick={() => setGrantExpanded((v) => !v)}
                className="flex items-center gap-1 text-muted-foreground/40 text-xs hover:text-muted-foreground/60 transition-colors"
              >
                Grant admin to user
                {grantExpanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>
              {grantExpanded && (
                <div className="mt-2 p-3 bg-secondary/40 rounded-lg space-y-2 border border-border/30">
                  <p className="text-xs text-muted-foreground">
                    Enter a username and the admin token to grant them admin
                    access.
                  </p>
                  <Input
                    data-ocid="profile.search_input"
                    value={grantUsername}
                    onChange={(e) => setGrantUsername(e.target.value)}
                    placeholder="Username (e.g. anonymousfrog)"
                    className="bg-secondary border-0 text-sm h-9"
                  />
                  <Input
                    type="password"
                    data-ocid="profile.textarea"
                    value={grantToken}
                    onChange={(e) => setGrantToken(e.target.value)}
                    placeholder="Admin token"
                    className="bg-secondary border-0 text-sm h-9"
                  />
                  <Button
                    type="button"
                    data-ocid="profile.confirm_button"
                    onClick={handleGrantAdminToUsername}
                    disabled={
                      grantAdminToUsername.isPending ||
                      !grantUsername.trim() ||
                      !grantToken.trim()
                    }
                    size="sm"
                    className="w-full bg-primary text-primary-foreground font-semibold"
                  >
                    {grantAdminToUsername.isPending
                      ? "Granting..."
                      : "Grant Admin"}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Videos grid */}
      <div className="border-t border-border px-1">
        <div className="px-3 py-3">
          <h3 className="font-display font-semibold text-sm text-muted-foreground">
            {isAdmin ? "ALL CLIPS (ADMIN)" : "MY CLIPS"}
          </h3>
        </div>
        {videosLoading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full" />
            ))}
          </div>
        ) : userVideos.length === 0 ? (
          <div
            data-ocid="profile.empty_state"
            className="flex flex-col items-center py-12 gap-3"
          >
            <span className="text-4xl">🎬</span>
            <p className="text-muted-foreground text-sm">No clips yet</p>
            <Button
              type="button"
              onClick={() => onNavigate("/upload")}
              className="bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 rounded-lg"
            >
              Upload first clip
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 pb-24">
            {userVideos.map((video, i) => (
              <div
                key={video.id.toString()}
                data-ocid={`profile.item.${i + 1}`}
                className="relative aspect-[9/16] bg-muted overflow-hidden cursor-pointer group"
              >
                <img
                  src={video.thumbnailBlobId.getDirectURL()}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Play size={28} className="text-white fill-white" />
                </div>
                <div className="absolute bottom-1 left-1 right-1">
                  <p className="text-white text-[10px] font-medium truncate drop-shadow">
                    {video.title}
                  </p>
                </div>
                {/* Admin delete button */}
                {isAdmin && (
                  <button
                    type="button"
                    data-ocid={`profile.delete_button.${i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVideo(video.id);
                    }}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Delete video"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
