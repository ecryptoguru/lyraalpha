"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { type LegalDocumentType } from "@/lib/legal-documents";

const LegalDocumentsModal = dynamic(
  () => import("@/components/legal/legal-documents-modal").then((mod) => mod.LegalDocumentsModal),
  { ssr: false },
);

export function FooterLegalLinks() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeType, setActiveType] = useState<LegalDocumentType>("privacy");
  const [shouldRenderModal, setShouldRenderModal] = useState(false);

  const openLegalModal = useMemo(
    () => (type: LegalDocumentType) => {
      setActiveType(type);
      setShouldRenderModal(true);
      setIsOpen(true);
    },
    [],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onMouseEnter={() => setShouldRenderModal(true)}
          onFocus={() => setShouldRenderModal(true)}
          onClick={() => openLegalModal("privacy")}
          className="transition-colors hover:text-amber-600 dark:hover:text-amber-100 py-2 min-h-[40px]"
        >
          Privacy Policy
        </button>
        <button
          type="button"
          onMouseEnter={() => setShouldRenderModal(true)}
          onFocus={() => setShouldRenderModal(true)}
          onClick={() => openLegalModal("terms")}
          className="transition-colors hover:text-amber-600 dark:hover:text-amber-100 py-2 min-h-[40px]"
        >
          Terms of Service
        </button>
      </div>

      {shouldRenderModal ? (
        <LegalDocumentsModal
          open={isOpen}
          onOpenChange={setIsOpen}
          activeType={activeType}
          onTypeChange={setActiveType}
        />
      ) : null}
    </>
  );
}
