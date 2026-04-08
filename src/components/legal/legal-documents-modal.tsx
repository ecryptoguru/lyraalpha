"use client";

import { FileText, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEGAL_DOCUMENTS,
  LegalDocumentType,
} from "@/lib/legal-documents";
import { cn } from "@/lib/utils";

interface LegalDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeType: LegalDocumentType;
  onTypeChange: (type: LegalDocumentType) => void;
}

const TAB_OPTIONS: { type: LegalDocumentType; label: string }[] = [
  { type: "privacy", label: "Privacy Policy" },
  { type: "terms", label: "Terms of Service" },
];

export function LegalDocumentsModal({
  open,
  onOpenChange,
  activeType,
  onTypeChange,
}: LegalDocumentsModalProps) {
  const doc = LEGAL_DOCUMENTS[activeType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl gap-0 p-0 overflow-hidden border-white/5 bg-card/95 backdrop-blur-xl max-h-[calc(100dvh-1rem)]">
        <DialogHeader className="border-b border-white/5 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                <span className="premium-gradient-text">{doc.title}</span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs uppercase tracking-widest text-muted-foreground/70">
                {doc.subtitle} • Updated {doc.updatedAt}
              </DialogDescription>
            </div>
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-muted/30 text-muted-foreground">
              {activeType === "privacy" ? (
                <Shield className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-4 inline-flex rounded-2xl border border-white/5 bg-muted/25 p-1">
            {TAB_OPTIONS.map((option) => (
              <Button
                key={option.type}
                type="button"
                size="sm"
                variant={activeType === option.type ? "default" : "ghost"}
                onClick={() => onTypeChange(option.type)}
                className={cn(
                  "h-8 rounded-xl px-3 text-[11px] font-bold uppercase tracking-widest",
                  activeType === option.type
                    ? "bg-primary text-black hover:bg-primary/90"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto scroll-smooth px-6 py-5 space-y-6 scrollbar-thin">
          {doc.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/90">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.body.map((paragraph) => (
                  <p
                    key={`${section.title}-${paragraph.slice(0, 32)}`}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
