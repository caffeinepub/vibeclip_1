import { BottomNav } from "@/components/BottomNav";
import { WelcomeModal } from "@/components/WelcomeModal";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { FeedPage } from "@/pages/FeedPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { UploadPage } from "@/pages/UploadPage";
import { useEffect, useRef, useState } from "react";

export default function App() {
  const [path, setPath] = useState(() => {
    const p = window.location.hash.replace("#", "") || "/";
    return p || "/";
  });

  const { loginStatus } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const prevLoginStatus = useRef(loginStatus);

  useEffect(() => {
    if (loginStatus === "success" && prevLoginStatus.current !== "success") {
      if (!sessionStorage.getItem("vc_welcomed")) {
        sessionStorage.setItem("vc_welcomed", "1");
        setShowWelcome(true);
      }
    }
    prevLoginStatus.current = loginStatus;
  }, [loginStatus]);

  useEffect(() => {
    const handler = () => {
      const p = window.location.hash.replace("#", "") || "/";
      setPath(p || "/");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (newPath: string) => {
    window.location.hash = newPath;
    setPath(newPath);
  };

  const showBottomNav = path !== "/login";
  const isFeedPage = path === "/";

  return (
    <div className="w-screen overflow-hidden" style={{ height: "100dvh" }}>
      {/* Main content area */}
      <div
        className={`w-full ${
          isFeedPage
            ? "h-full"
            : showBottomNav
              ? "h-[calc(100dvh-64px)] overflow-y-auto"
              : "h-full"
        }`}
      >
        {path === "/" && <FeedPage onNavigate={navigate} />}
        {path === "/upload" && <UploadPage onNavigate={navigate} />}
        {path === "/profile" && <ProfilePage onNavigate={navigate} />}
        {path === "/discover" && <DiscoverPage onNavigate={navigate} />}
        {path === "/login" && <LoginPage onNavigate={navigate} />}
        {!["/", "/upload", "/profile", "/discover", "/login"].includes(
          path,
        ) && <FeedPage onNavigate={navigate} />}
      </div>

      {/* Bottom navigation */}
      {showBottomNav && <BottomNav currentPath={path} onNavigate={navigate} />}

      <Toaster />

      {/* Welcome modal */}
      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        isNewLogin={true}
      />

      {/* Footer (visible on non-feed pages) */}
      {!isFeedPage && path !== "/login" && (
        <div className="fixed bottom-[64px] left-0 right-0 text-center py-1.5 bg-background/80">
          <p className="text-muted-foreground/50 text-[10px]">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
