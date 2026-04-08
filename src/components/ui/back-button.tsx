"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function BackButton({ 
  className = "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl hover:bg-primary/10 hover:border-primary/20 transition-all rounded-2xl",
  size = "icon",
  variant = "ghost"
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBack}
      className={className}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
