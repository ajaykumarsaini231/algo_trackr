import Link from "next/link";
import type { Metadata } from "next";
import { Mail, Github, MessageSquare } from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/schema";

export const metadata: Metadata = buildMetadata({
  title: "Contact DSAspire",
  description:
    "Get in touch with the DSAspire team — questions, feedback, bug reports and partnership enquiries.",
  path: "/contact",
});

// NOTE: update this to a real, monitored inbox (or set up the alias) before launch.
const CONTACT_EMAIL = "hello@dsaspire.com";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Contact</span>
      </nav>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Contact us</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Have a question, found a bug, or want to suggest a feature? We&apos;d love to hear
        from you.
      </p>

      <div className="mt-8 space-y-4">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Email</div>
            <div className="text-sm text-muted-foreground">{CONTACT_EMAIL}</div>
          </div>
        </a>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Feedback</div>
            <div className="text-sm text-muted-foreground">
              Tell us what to build next — every suggestion is read.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Github className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Community</div>
            <div className="text-sm text-muted-foreground">
              Report issues and follow development updates.
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Looking for something to study? Head back to{" "}
        <Link href="/topics" className="font-medium text-primary hover:underline">topics</Link>{" "}
        or explore our{" "}
        <Link href="/roadmaps" className="font-medium text-primary hover:underline">roadmaps</Link>.
      </p>
    </div>
  );
}
