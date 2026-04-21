import React from "react";

interface ExternalLinksProps {
  links?: {
    homepage?: string[];
    whitepaper?: string | null;
    blockchain?: string[];
    twitter?: string | null;
    reddit?: string | null;
    github?: string[];
    telegram?: string | null;
  };
}

export function AssetExternalLinks({ links }: ExternalLinksProps) {
  if (!links) return null;

  const hasAnyLink = !!(
    links.homepage?.length ||
    links.github?.length ||
    links.twitter ||
    links.reddit ||
    links.whitepaper ||
    links.blockchain?.length ||
    links.telegram
  );

  if (!hasAnyLink) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Links & Resources</p>
      <div className="flex flex-wrap gap-2">
        {links.homepage?.[0] && (
          <a
            href={links.homepage[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Website
          </a>
        )}
        {links.whitepaper && (
          <a
            href={links.whitepaper}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Whitepaper
          </a>
        )}
        {links.github?.[0] && (
          <a
            href={links.github[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
            GitHub
          </a>
        )}
        {links.twitter && (
          <a
            href={links.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-info" />
            Twitter / X
          </a>
        )}
        {links.reddit && (
          <a
            href={links.reddit}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Reddit
          </a>
        )}
        {links.telegram && (
          <a
            href={links.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Telegram
          </a>
        )}
        {links.blockchain?.[0] && (
          <a
            href={links.blockchain[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border/30 dark:border-white/5 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Explorer
          </a>
        )}
      </div>
    </div>
  );
}
