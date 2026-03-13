import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "motion/react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  isNewLogin?: boolean;
}

export function WelcomeModal({
  open,
  onClose,
  isNewLogin = true,
}: WelcomeModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        data-ocid="welcome.modal"
        className="bg-card border-border max-w-xs mx-auto text-center p-0 overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 px-6 pt-8 pb-7"
        >
          {/* Logo */}
          <motion.img
            src="/assets/generated/vibeclip-frog-logo-transparent.dim_200x200.png"
            alt="Vibeclip"
            className="w-20 h-20 object-contain"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.1,
              duration: 0.5,
              type: "spring",
              bounce: 0.4,
            }}
          />

          {/* Text */}
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl tracking-tight">
              {isNewLogin ? "Welcome to Vibeclip!" : "Welcome back!"}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isNewLogin
                ? "Your stage is ready. Start exploring viral clips or drop your own."
                : "Great to see you again. The feed's been waiting."}
            </p>
          </div>

          {/* CTA */}
          <Button
            type="button"
            data-ocid="welcome.primary_button"
            onClick={onClose}
            className="w-full h-11 bg-primary text-primary-foreground font-bold text-base rounded-xl neon-glow"
          >
            Let&apos;s go! 🐸
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
