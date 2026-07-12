"use client";

import type { ElementType } from "react";
import Link from "next/link";
import {
  Award,
  Briefcase,
  Code2,
  Download,
  ExternalLink,
  FolderGit2,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  Reveal,
  Stagger,
  StaggerItem,
  TiltCard,
  AnimatedCounter,
  GradientBackground,
} from "@/components/motion";

const PROFILE = {
  name: "Ajay Kumar Saini",
  title: "Full-Stack Developer",
  location: "IIT Patna · India",
  email: "nabalsaini231@gmail.com",
  phone: "+91-8107469345",
  github: "https://github.com/ajaykumarsaini231",
  linkedin: "https://www.linkedin.com/in/ajay-kumar-saini",
  summary:
    "Full-Stack Developer who builds production dashboards and ERP systems with Next.js, React, TypeScript, Node.js, Prisma and PostgreSQL. Strong in REST API design, RBAC authentication, third-party API integration (Google Drive, Gmail, WhatsApp Cloud), AI/LLM automation, Docker and AWS CI/CD.",
};

const STATS: { value: number; suffix?: string; decimals?: number; label: string }[] = [
  { value: 650, suffix: "+", label: "DSA problems solved" },
  { value: 7.82, decimals: 2, label: "CPI · IIT Patna" },
  { value: 3, suffix: "+", label: "Internships" },
  { value: 3000, suffix: "+", label: "Users served" },
];

const SKILLS: { group: string; items: string[] }[] = [
  { group: "Languages", items: ["C", "C++", "Python", "JavaScript", "TypeScript", "SQL"] },
  { group: "Frontend", items: ["React", "Next.js (App Router)", "Tailwind CSS", "Redux Toolkit"] },
  { group: "Backend", items: ["Node.js", "Express.js", "REST APIs", "WebSockets", "Prisma ORM", "JWT / RBAC"] },
  { group: "Databases", items: ["PostgreSQL", "MySQL", "MongoDB", "Query Optimization"] },
  { group: "APIs & Integrations", items: ["Google Drive", "Gmail", "WhatsApp Cloud", "Zoho", "Groq / OpenAI", "Webhooks"] },
  { group: "Cloud & DevOps", items: ["Docker", "AWS (EC2/S3)", "Vercel", "CI/CD", "Git", "Linux"] },
];

const EXPERIENCE = [
  {
    role: "Full Stack Developer Intern",
    org: "METNMAT Innovations Pvt. Ltd.",
    period: "Jan 2025 – Present",
    location: "Remote / India",
    points: [
      "Shipped a production ERP dashboard on Next.js, TypeScript, Node.js, Prisma and PostgreSQL across 7 modules — products, enquiries, quotations, orders, invoices, inventory and tasks.",
      "Integrated WhatsApp Cloud API, Gmail API and Google Drive API for messaging, email-based OTP two-factor login and product media sync.",
      "Built a 4-stage enquiry-to-invoice pipeline with server-side PDF/DOCX generation, RBAC-protected REST APIs and idempotent dry-run sync over a 150+ product catalog.",
    ],
  },
  {
    role: "AI/ML Intern",
    org: "Docyt India Pvt. Ltd.",
    period: "Aug 2025 – Sep 2025",
    location: "Remote",
    points: [
      "Engineered EDA and preprocessing pipelines and benchmarked ML models, cutting training overhead 28% and improving KPI alignment 11.5%.",
      "Standardized feature-engineering and experiment-tracking workflows, accelerating model iteration 20%.",
    ],
  },
  {
    role: "Research Intern",
    org: "IIT Jodhpur",
    period: "May 2025 – Jul 2025",
    location: "Jodhpur, India",
    points: [
      "Simulated hot tearing in Al-206 with the CRC criterion, isolating a critical solid-fraction range of 0.88–0.96.",
      "Validated predictive models against SEM/XRD analysis, improving casting yield 8.4%.",
    ],
  },
];

const PROJECTS = [
  {
    name: "METNMAT Operations Dashboard",
    tag: "AI-Powered ERP & Product Automation",
    year: "2025",
    tech: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Google Drive API", "LLM APIs"],
    points: [
      "Architected category- and product-wise Google Drive folder mapping, binding each product's media to its PostgreSQL record through two-way sync.",
      "Added AI/LLM-assisted description and price-research workflows with confidence scoring, dry-run mode and audited upserts that protect internal pricing.",
    ],
    href: PROFILE.github,
  },
  {
    name: "Questivo",
    tag: "AI-Driven Assessment & Real-Time Streaming",
    year: "Jan 2026",
    tech: ["Next.js", "Express.js", "WebSockets", "Docker", "AWS", "Groq SDK"],
    points: [
      "Built an AI assessment engine with the Groq SDK, using full-duplex WebSocket streaming and Redis queues to hold transaction isolation under 500+ concurrent requests.",
      "Containerized with Docker and deployed via CI/CD on AWS EC2/S3 for scalable infrastructure.",
    ],
    href: PROFILE.github,
  },
];

const POSITIONS = [
  {
    role: "Technical Lead & Sub-Coordinator (Web & Development)",
    org: "Anwesha — Cultural Fest, IIT Patna",
    period: "Dec 2024 – May 2026",
    detail: "Architected the Next.js + PostgreSQL platform supporting 3,000+ active festival users.",
  },
  {
    role: "Head of Sponsorship & RSP Management",
    org: "E-Cell & Celesta, IIT Patna",
    period: "Aug 2024 – Apr 2026",
    detail: "Managed corporate partnerships and cross-functional operations for the annual techno-management fest.",
  },
];

const ACHIEVEMENTS = [
  "Selected for the Data & AI Operations Internship at Grindwell Norton Limited (Saint-Gobain Group).",
  "Solved 650+ algorithmic problems across LeetCode and competitive-programming platforms.",
  "Secured Top 2% of 1.2 Million+ candidates in JEE Advanced 2023.",
  "Full-Stack AI Engineer: ML Foundations & Secure Python/Django — Udemy.",
];

const SOCIALS = [
  { icon: Github, label: "GitHub", href: PROFILE.github },
  { icon: Linkedin, label: "LinkedIn", href: PROFILE.linkedin },
  { icon: Mail, label: "Email", href: `mailto:${PROFILE.email}` },
];

function SectionHeading({ icon: Icon, kicker, title }: { icon: ElementType; kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <Icon className="h-4 w-4" />
        {kicker}
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}

export function AboutContent() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative">
        <GradientBackground />
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
            <Reveal className="flex justify-center md:justify-start">
              {/* Profile photo placeholder */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary via-[#8b5cf6] to-[#14b8a6] opacity-70 blur-lg" />
                <div className="relative flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-[#14b8a6] text-5xl font-black text-white shadow-2xl ring-1 ring-white/20">
                  AKS
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Creator of DSAspire
              </div>
              <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
                {PROFILE.name}
              </h1>
              <p className="mt-2 text-lg font-medium text-primary">{PROFILE.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {PROFILE.location}
              </p>
              <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {PROFILE.summary}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="/resume.pdf"
                  download="Ajay-Kumar-Saini-Resume.pdf"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
                >
                  <Download className="h-4 w-4" /> Download résumé
                </a>
                <Link
                  href="/contact"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background/60 px-5 text-sm font-semibold backdrop-blur transition-colors hover:bg-accent"
                >
                  Get in touch
                </Link>
                <div className="flex items-center gap-1.5">
                  {SOCIALS.map(({ icon: Icon, label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Animated stats */}
      <section className="border-y border-border bg-muted/30">
        <Stagger className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <StaggerItem key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                <AnimatedCounter value={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        {/* Skills */}
        <section className="py-16">
          <Reveal>
            <SectionHeading icon={Code2} kicker="Toolbox" title="Technical skills" />
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SKILLS.map((cat) => (
              <StaggerItem
                key={cat.group}
                className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/40"
              >
                <h3 className="text-sm font-semibold text-muted-foreground">{cat.group}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cat.items.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Experience timeline */}
        <section className="py-16">
          <Reveal>
            <SectionHeading icon={Briefcase} kicker="Journey" title="Experience" />
          </Reveal>
          <div className="relative border-l border-border pl-8">
            {EXPERIENCE.map((job) => (
              <Reveal key={job.org} className="relative pb-10 last:pb-0">
                <span className="absolute -left-[38px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-lg font-semibold">{job.role}</h3>
                  <span className="text-xs font-medium text-muted-foreground">{job.period}</span>
                </div>
                <div className="text-sm font-medium text-primary">{job.org}</div>
                <div className="text-xs text-muted-foreground">{job.location}</div>
                <ul className="mt-3 space-y-2">
                  {job.points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="py-16">
          <Reveal>
            <SectionHeading icon={FolderGit2} kicker="Build log" title="Featured projects" />
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {PROJECTS.map((p) => (
              <TiltCard key={p.name} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card/70 p-6 backdrop-blur transition-colors hover:border-primary/40">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{p.name}</h3>
                      <p className="text-sm text-primary">{p.tag}</p>
                    </div>
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${p.name} on GitHub`}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <span className="mt-1 inline-block text-xs text-muted-foreground">{p.year}</span>
                  <ul className="mt-3 space-y-2">
                    {p.points.map((pt, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tech.map((t) => (
                      <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* Education + Positions */}
        <section className="grid gap-8 py-16 lg:grid-cols-2">
          <div>
            <Reveal>
              <SectionHeading icon={GraduationCap} kicker="Academics" title="Education" />
            </Reveal>
            <Reveal className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
              <h3 className="font-semibold">Indian Institute of Technology (IIT) Patna</h3>
              <p className="mt-1 text-sm text-primary">B.Tech, Metallurgical &amp; Materials Engineering</p>
              <p className="mt-1 text-xs text-muted-foreground">Aug 2023 – Present · CPI 7.82</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Relevant coursework: Data Structures &amp; Algorithms, DBMS, Machine Learning, OOP.
              </p>
            </Reveal>
          </div>
          <div>
            <Reveal>
              <SectionHeading icon={Users} kicker="Leadership" title="Positions of responsibility" />
            </Reveal>
            <div className="space-y-4">
              {POSITIONS.map((pos) => (
                <Reveal key={pos.org} className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-semibold">{pos.role}</h3>
                    <span className="text-xs text-muted-foreground">{pos.period}</span>
                  </div>
                  <div className="text-sm text-primary">{pos.org}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{pos.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Achievements */}
        <section className="py-16">
          <Reveal>
            <SectionHeading icon={Trophy} kicker="Milestones" title="Achievements & certifications" />
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => (
              <StaggerItem
                key={a}
                className="flex gap-3 rounded-xl border border-border bg-card/60 p-5 backdrop-blur"
              >
                <Award className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* DSAspire tie-in */}
        <section className="pb-20">
          <Reveal className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-[#14b8a6]/10 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why I built DSAspire</h2>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-muted-foreground">
              Having solved 650+ problems myself, I wanted one focused workspace that combined a
              curated catalog, pattern-based learning and honest progress tracking. DSAspire is
              that tool — free and open for everyone preparing for coding interviews.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/topics"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Explore the platform
              </Link>
              <Link
                href="/roadmaps"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                View roadmaps
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
