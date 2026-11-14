import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/components/hooks/useAnswerSync";

interface Props {
  status: SyncStatus;
  sessionExpired?: boolean;
  onRetry: () => void;
  className?: string;
}

export function SyncBanner({ status, sessionExpired = false, onRetry, className }: Props) {
  return (
    <div aria-live="polite" className={cn("min-h-8 text-center text-sm", className)}>
      {status === "pending" ? <p className="text-blue-100/70">Saving…</p> : null}
      {status === "saved" ? <p className="text-green-200">Saved</p> : null}
      {status === "failed" ? (
        <p className="flex flex-wrap items-center justify-center gap-2 text-red-200">
          <span>{sessionExpired ? "Not saved — session expired" : "Not saved"}</span>
          {sessionExpired ? (
            <a href="/auth/signin" className="underline hover:text-red-100">
              Sign in again
            </a>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </p>
      ) : null}
    </div>
  );
}
