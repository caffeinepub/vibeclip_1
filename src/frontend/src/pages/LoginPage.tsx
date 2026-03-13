import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login, loginStatus, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    onNavigate("/");
    return null;
  }

  const isLoggingIn = loginStatus === "logging-in";

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 bg-background">
      {/* Logo + branding */}
      <div className="text-center mb-10">
        <div className="mb-4">
          <img
            src="/assets/generated/vibeclip-frog-logo-transparent.dim_200x200.png"
            alt="Vibeclip frog mascot"
            className="w-32 h-32 mx-auto object-contain"
          />
        </div>
        <h1 className="font-display font-bold text-4xl tracking-tight mb-2">
          <span className="text-primary neon-text-glow">vibe</span>clip
        </h1>
        <p className="text-muted-foreground text-base">
          Short-form videos. Big vibes.
        </p>
      </div>

      {/* Features list */}
      <div className="w-full max-w-xs space-y-3 mb-8">
        {[
          { emoji: "🎬", text: "Upload & share your clips" },
          { emoji: "❤️", text: "Like and comment on videos" },
          { emoji: "🔥", text: "Discover trending content" },
          { emoji: "👥", text: "Follow your favorite creators" },
        ].map(({ emoji, text }) => (
          <div key={text} className="flex items-center gap-3 text-sm">
            <span className="text-xl">{emoji}</span>
            <span className="text-foreground/80">{text}</span>
          </div>
        ))}
      </div>

      {/* Login button */}
      <Button
        type="button"
        onClick={login}
        disabled={isLoggingIn}
        className="w-full max-w-xs h-13 text-base font-bold rounded-xl bg-primary text-primary-foreground neon-glow hover:opacity-90 transition-opacity"
      >
        {isLoggingIn ? (
          <>
            <Loader2 className="animate-spin mr-2" size={18} />
            Connecting...
          </>
        ) : (
          "Get Started with Internet Identity"
        )}
      </Button>

      <p className="text-muted-foreground text-xs text-center mt-4 max-w-xs">
        Secure, decentralized login powered by the Internet Computer.
      </p>

      {/* Skip */}
      <button
        type="button"
        onClick={() => onNavigate("/")}
        className="mt-6 text-muted-foreground text-sm hover:text-foreground transition-colors"
      >
        Continue as guest
      </button>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-muted-foreground/50 text-xs">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
