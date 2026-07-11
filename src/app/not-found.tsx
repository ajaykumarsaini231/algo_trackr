import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This page wandered off. Let&apos;s get you back on track.
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
