"use client";

import { useState, useEffect, useRef, useCallback, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DomainPreviewProps {
  domain?: string | null;
  unknownLabel: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
  triggerClassName?: string;
}

export function DomainPreview({
  domain,
  unknownLabel,
  copyLabel,
  copiedLabel,
  className,
  triggerClassName,
}: DomainPreviewProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const domainText = domain || unknownLabel;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleTriggerClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const handleCopyResult = useCallback((_: string, result: boolean) => {
    if (result) {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1200);
    } else {
      setCopied(false);
    }
  }, []);

  return (
    <div className={cn("min-w-0", className)} onClick={(event) => event.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full min-w-0 text-left font-medium truncate text-sm rounded-sm outline-none cursor-pointer underline-offset-4 decoration-dotted decoration-transparent hover:underline hover:decoration-muted-foreground/60 hover:text-foreground/95 focus-visible:ring-2 focus-visible:ring-ring/60",
              triggerClassName,
            )}
            onClick={handleTriggerClick}
          >
            {domainText}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-[min(92vw,30rem)] rounded-lg border-border/50 bg-popover p-2.5 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 max-h-28 overflow-auto rounded-md border border-border/50 bg-muted/25 px-2.5 py-2 text-[13px] leading-5 break-all">
              {domainText}
            </code>
            {domain ? (
              <CopyToClipboard text={domain} onCopy={handleCopyResult}>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title={copied ? copiedLabel : copyLabel}
                  aria-label={copied ? copiedLabel : copyLabel}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-md border border-border/40",
                    copied
                      ? "text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/20 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CopyToClipboard>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
