"use client";

import * as React from "react";
import Link from "next/link";
import { Github, Linkedin, Mail, Phone, Send } from "lucide-react";
import { Reveal, Stagger, StaggerItem, GradientBackground } from "@/components/motion";

const EMAIL = "nabalsaini231@gmail.com";
const PHONE = "+91-8107469345";
const GITHUB = "https://github.com/ajaykumarsaini231";
const LINKEDIN = "https://www.linkedin.com/in/ajay-kumar-saini";

const CHANNELS = [
  { icon: Mail, label: "Email", value: EMAIL, href: `mailto:${EMAIL}` },
  { icon: Phone, label: "Phone", value: PHONE, href: `tel:${PHONE.replace(/[^+\d]/g, "")}` },
  { icon: Linkedin, label: "LinkedIn", value: "ajay-kumar-saini", href: LINKEDIN },
  { icon: Github, label: "GitHub", value: "ajaykumarsaini231", href: GITHUB },
];

export function ContactContent() {
  const [form, setForm] = React.useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = React.useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(form.subject || `Message from ${form.name || "a visitor"}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name}\n${form.email}`);
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  const inputCls =
    "h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring/30";

  return (
    <div className="relative overflow-x-hidden">
      <GradientBackground />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <Reveal className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Let&apos;s connect</h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
            Questions about DSAspire, feedback, collaboration or just want to say hi? Send a
            message — I read every one.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Form */}
          <Reveal>
            <form
              onSubmit={onSubmit}
              className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Name</label>
                  <input id="name" required value={form.name} onChange={set("name")} className={inputCls} placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
                  <input id="email" type="email" required value={form.email} onChange={set("email")} className={inputCls} placeholder="you@example.com" />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">Subject</label>
                <input id="subject" value={form.subject} onChange={set("subject")} className={inputCls} placeholder="What's this about?" />
              </div>
              <div className="mt-4">
                <label htmlFor="message" className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea
                  id="message"
                  required
                  value={form.message}
                  onChange={set("message")}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  placeholder="Write your message…"
                />
              </div>
              <button
                type="submit"
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md sm:w-auto"
              >
                <Send className="h-4 w-4" /> Send message
              </button>
              {sent && (
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  Your email client should have opened. If not, email{" "}
                  <a href={`mailto:${EMAIL}`} className="font-medium text-primary hover:underline">{EMAIL}</a> directly.
                </p>
              )}
            </form>
          </Reveal>

          {/* Channels */}
          <Stagger className="space-y-3">
            {CHANNELS.map(({ icon: Icon, label, value, href }) => (
              <StaggerItem key={label}>
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card/70 p-4 backdrop-blur transition-colors hover:border-primary/40"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="truncate text-sm text-muted-foreground">{value}</div>
                  </div>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal className="mt-10 text-center text-sm text-muted-foreground">
          Prefer to browse first?{" "}
          <Link href="/topics" className="font-medium text-primary hover:underline">Explore topics</Link>{" "}
          or read{" "}
          <Link href="/about" className="font-medium text-primary hover:underline">about the creator</Link>.
        </Reveal>
      </div>
    </div>
  );
}
