"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. This has been logged."}
      </p>
      <Button variant="gradient" className="mt-6 gap-2" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
