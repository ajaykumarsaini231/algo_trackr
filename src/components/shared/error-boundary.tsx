"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  error?: Error;
}

/** Client-side error boundary for wrapping individual widgets/sections. */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-destructive" />
          <h3 className="text-base font-semibold">Something went wrong</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred while rendering this section."}
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={this.reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
