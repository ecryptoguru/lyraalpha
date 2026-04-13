"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * Shared markdown renderer for chat messages.
 * Used by both PublicMyraPanel (landing) and LiveChatWidget (dashboard).
 */

export function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const codeMatch = part.match(/^`([^`]+)`$/);
    if (codeMatch)
      return (
        <code key={`${keyPrefix}-c${i}`} className="rounded bg-black/10 px-1 font-mono text-[11px] dark:bg-white/10">
          {codeMatch[1]}
        </code>
      );
    const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) return <strong key={`${keyPrefix}-b${i}`}>{boldMatch[1]}</strong>;
    const italicMatch = part.match(/^\*(.+?)\*$/);
    if (italicMatch) return <em key={`${keyPrefix}-i${i}`}>{italicMatch[1]}</em>;
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      const href = linkMatch[2];
      const isSafeUrl = /^(https?:\/\/|\/)/i.test(href);
      if (!isSafeUrl) return <span key={`${keyPrefix}-l${i}`}>{linkMatch[1]}</span>;
      return (
        <a
          key={`${keyPrefix}-l${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-amber-600 underline underline-offset-2 transition-colors hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
        >
          {linkMatch[1]}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      );
    }
    return <span key={`${keyPrefix}-t${i}`}>{part}</span>;
  });
}

export function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const fence = line.trimStart().match(/^```(\w*)/);
      const lang = fence?.[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      elements.push(
        <pre key={`block-code-${i}`} className="my-1.5 overflow-x-auto rounded-lg bg-black/10 p-2.5 font-mono text-[11px] leading-relaxed dark:bg-white/8">
          {lang && <span className="mb-1 block text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/30">{lang}</span>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // H3
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      elements.push(
        <p key={`h3-${i}`} className="mt-2 mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-white/40">
          {renderInline(h3[1], `h3-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // H2
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      elements.push(
        <p key={`h2-${i}`} className="mt-2.5 mb-1 text-[12px] font-bold text-slate-700 dark:text-white/80">
          {renderInline(h2[1], `h2-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // Bullet list item
    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet) {
      elements.push(
        <span key={`li-${i}`} className="flex items-start gap-1.5 text-[12px] leading-relaxed">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
          <span>{renderInline(bullet[1], `li-${i}`)}</span>
        </span>
      );
      i++;
      continue;
    }

    // Numbered list item
    const numbered = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numbered) {
      elements.push(
        <span key={`nl-${i}`} className="flex items-start gap-1.5 text-[12px] leading-relaxed">
          <span className="mt-0.5 shrink-0 text-[10px] font-bold text-amber-500/70">{numbered[1]}.</span>
          <span>{renderInline(numbered[2], `nl-${i}`)}</span>
        </span>
      );
      i++;
      continue;
    }

    // Empty line → spacing
    if (line.trim() === "") {
      if (elements.length > 0) {
        elements.push(<span key={`sp-${i}`} className="block h-1.5" />);
      }
      i++;
      continue;
    }

    // Regular paragraph line
    elements.push(
      <span key={`p-${i}`} className="block text-[12px] leading-relaxed">
        {renderInline(line, `p-${i}`)}
      </span>
    );
    i++;
  }

  return <>{elements}</>;
}
