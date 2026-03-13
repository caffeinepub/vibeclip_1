import { cn } from "@/lib/utils";
import { Compass, Home, Plus, User } from "lucide-react";

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function BottomNav({ currentPath, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
      <div className="flex items-center justify-around px-2 pb-safe">
        {/* Home */}
        <button
          type="button"
          data-ocid="nav.home_link"
          onClick={() => onNavigate("/")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-4 py-3 transition-colors",
            currentPath === "/"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Home size={22} strokeWidth={currentPath === "/" ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        {/* Discover */}
        <button
          type="button"
          data-ocid="nav.discover_link"
          onClick={() => onNavigate("/discover")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-4 py-3 transition-colors",
            currentPath === "/discover"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Compass
            size={22}
            strokeWidth={currentPath === "/discover" ? 2.5 : 1.8}
          />
          <span className="text-[10px] font-medium">Discover</span>
        </button>

        {/* Upload (center CTA) */}
        <button
          type="button"
          data-ocid="nav.upload_button"
          onClick={() => onNavigate("/upload")}
          className="flex flex-col items-center gap-0.5 px-2 py-2"
        >
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
              currentPath === "/upload"
                ? "bg-primary neon-glow scale-110"
                : "bg-primary hover:scale-105 active:scale-95",
            )}
          >
            <Plus
              size={24}
              strokeWidth={2.5}
              className="text-primary-foreground"
            />
          </div>
        </button>

        {/* Profile */}
        <button
          type="button"
          data-ocid="nav.profile_link"
          onClick={() => onNavigate("/profile")}
          className={cn(
            "flex flex-col items-center gap-0.5 px-4 py-3 transition-colors",
            currentPath === "/profile"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <User
            size={22}
            strokeWidth={currentPath === "/profile" ? 2.5 : 1.8}
          />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}
