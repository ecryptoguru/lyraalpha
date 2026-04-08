"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useState } from "react";

/** Strip common markdown from question strings so they display as clean text in buttons */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1") // [text][ref] → text
    .replace(/\*\*([^*]+)\*\*/g, "$1")        // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1")            // *italic* → italic
    .replace(/`([^`]+)`/g, "$1")             // `code` → code
    .replace(/[\[\]]/g, "")
    .trim();
}

interface RelatedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
}

export function RelatedQuestions({
  questions,
  onQuestionClick,
}: RelatedQuestionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (questions.length === 0) return null;

  return (
    <div className="pt-2 mt-2 border-t border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between hover:surface-elevated mb-2 px-0 h-auto py-2 group/rel hover:no-underline no-underline cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-primary opacity-60" />
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
            Related Questions
          </span>
          <span className="text-[10px] text-muted-foreground opacity-40">
            ({questions.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          {questions.map((question, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2.5 px-4 hover:bg-primary/5 transition-all duration-300 border-border surface-elevated whitespace-normal group/btn cursor-pointer"
              onClick={() => onQuestionClick(stripMarkdown(question))}
            >
              <span className="text-xs text-foreground/80 group-hover/btn:text-foreground transition-colors leading-relaxed">
                {stripMarkdown(question)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
