# 06 · Component Hierarchy, UI/UX, Responsive, A11y, Dark Mode

Covers **#4 component hierarchy · #5 UI/UX · #6 responsive · #7 accessibility · #56 mobile-first · #58 dark mode · #66 semantic HTML.**

Builds on what exists: Radix primitives in `components/ui/`, `next-themes`, `cn()` (tailwind-merge), `framer-motion`, `lucide-react`, `class-variance-authority`.

---

## 1. Design system (tokens)

Keep Tailwind + CSS variables (you already theme via `globals.css`). Formalize a token layer so light/dark and brand stay consistent.

```css
/* globals.css — HSL channels so Tailwind opacity modifiers work */
:root {
  --background:0 0% 100%; --foreground:240 10% 4%;
  --card:0 0% 100%; --muted:240 5% 96%; --muted-foreground:240 4% 46%;
  --primary:243 75% 59%;         /* indigo — brand */
  --primary-foreground:0 0% 100%;
  --border:240 6% 90%; --ring:243 75% 59%;
  --easy:142 71% 45%; --medium:38 92% 50%; --hard:0 84% 60%;  /* difficulty scale */
  --radius:0.75rem;
}
.dark {
  --background:240 10% 4%; --foreground:0 0% 98%;
  --card:240 8% 7%; --muted:240 5% 13%; --muted-foreground:240 5% 65%;
  --border:240 5% 18%; --ring:243 75% 66%;
}
```

**Scales:** type 12→48px (`text-xs`…`text-5xl`), 4px spacing grid, radius `sm/md/lg/xl`, elevation via ring+shadow not heavy shadows, motion 150–250ms `ease-out` (respect `prefers-reduced-motion`). Fonts already wired: **Inter** (sans) + **JetBrains Mono** (code) via `next/font` (self-hosted, no CLS).

---

## 2. Component tree (public plane)

```
RootLayout
├── Providers (theme, toaster, session-for-app-only)
├── (marketing|content)/layout
│   ├── PublicHeader
│   │   ├── Logo · MegaMenu (Learn/Practice/Interview) · SearchTrigger(⌘K)
│   │   ├── ThemeToggle · AuthButtons | UserMenu
│   │   └── MobileNav (Sheet/Drawer)
│   ├── Breadcrumbs                      → emits BreadcrumbList JSON-LD
│   ├── <main id="main">{page}</main>    → skip-link target
│   └── PublicFooter (fat, internal-link hub)
│
├── ProblemView (RSC)
│   ├── ProblemHeader (title, DifficultyBadge, RatingBadge, CompanyChips, PatternChips)
│   ├── SolvedOverlay (client island → /api/me/progress)
│   ├── StatementBlock · ExamplesList · ConstraintsList
│   ├── HintLadder (client, calls /api/ai/hint — gated CTA if logged out)
│   ├── ComplexityTable · ApproachSummary
│   ├── RelatedProblems (RelatedLinks) · CompanyAskedIn
│   ├── FaqAccordion                     → FAQPage JSON-LD
│   └── SolveCta → /practice/[slug]
│
├── TopicHub (RSC): Definition · SubtopicGrid · PatternList · RoadmapMini ·
│                   TopProblemsTable · GuideLinks · FaqAccordion · KeyTakeaways
├── PatternExplainer (RSC): WhenToUse · TemplateCode(CodeBlock,multi-lang tabs) ·
│                   DecisionFlowchart · ComplexityTable · ProblemList · Faq
├── AlgorithmReference (RSC): Toc · Definition · Intuition · ProofSketch ·
│                   ComplexityTable · ReferenceImpl(tabs) · Variations · Citations
├── CompanyHub (RSC): Overview · RoundsTimeline · PrepPlan · TaggedProblemsTable(faceted) ·
│                   TopPatterns · Experiences · Faq
├── RoadmapGraph (client, SVG/react-flow-lite): Node → NodeDrawer(links to content)
└── ArticleLayout (MDX): Toc · Prose(MDXComponents) · AuthorByline · Reviewed-by ·
                    KeyTakeaways · Faq · RelatedLinks · Share
```

**Shared content atoms** (`components/content/`): `CodeBlock` (server-highlighted via Shiki, copy button, language tabs), `ComplexityTable`, `DifficultyBadge`, `Callout`, `Toc` (scroll-spy), `FaqAccordion` (Radix Accordion + emits schema), `RelatedLinks`, `AnswerBlock` (GEO — bolded one-line answer), `KeyTakeaways`.

## 3. Component tree (app plane)

```
(app)/layout → AppShell (existing sidebar from lib/nav.ts) + SessionProvider + CommandPalette
├── Dashboard: StreakCard · ContinueLearning · DueRevisionCard · StatGrid ·
│              ActivityHeatmap(existing) · Recommendations · RecentActivity
├── PracticeWorkspace: SplitPane
│   ├── left: ProblemPanel (reuses ProblemView, +user notes)
│   └── right: EditorPanel (CodeEditor) · RunPanel(tests) · AiToolsDock
│        └── AiToolsDock: HintTab · ExplainTab · ReviewTab · DoubtChat
├── RevisionBoard: DueToday · Forecast(30d) · GradeButtons(SM-2)
├── MockInterviewRoom: PromptStream · CodePad · Timer · Whiteboard(excalidraw-lite) · Rubric
├── LeaderboardTable(virtualized) · ProfileCard · AchievementGrid · PlaylistBoard
└── SettingsTabs · AdminConsole(existing) · Studio(CMS editor)
```

**Reuse rule:** `ProblemView` renders on both `/problems/[slug]` (public, no user data) and inside `PracticeWorkspace` (with `UserProgress`). One component, two data props — never fork.

---

## 4. Client/server boundary discipline

- **Default = Server Component.** Pages under `(content)`/`(marketing)` are RSC; add `"use client"` only to interaction leaves (`HintLadder`, `RoadmapGraph`, `CommandPalette`, `SolvedOverlay`, filters).
- **This is the single biggest SEO fix.** Today `topics/[topic]/page.tsx` is `"use client"` + `useParams` → crawlers get an empty shell. Refactor pattern:

```tsx
// BEFORE: "use client"; const {topic}=useParams(); ...fetch after hydration
// AFTER  (RSC):
export async function generateStaticParams() { return (await getTopSlugs()).map(topic => ({ topic })); }
export async function generateMetadata({ params }) { /* doc 07 factory */ }
export default async function Page({ params }) {
  const hub = await getTopicHub(params.topic);   // server fetch, in HTML
  if (!hub) notFound();
  return <TopicHub hub={hub} />;                 // full content server-rendered
}
```

---

## 5. Responsive & mobile-first

- **Mobile-first Tailwind**: base styles target ~360px; layer `sm md lg xl 2xl`. Never `hidden` critical content on mobile (crawlers + parity).
- **Layout primitives**: container `max-w-screen-xl px-4 sm:px-6 lg:px-8`; content prose `max-w-[70ch]`; problem workspace = stacked tabs on mobile, `SplitPane` ≥`lg`.
- **Touch targets** ≥44px; sticky mobile action bar for primary CTAs; bottom-sheet filters on mobile (`Dialog`→`Drawer`).
- **Tables → cards** on mobile (problem lists become stacked cards). Horizontal scroll only inside an `overflow-x-auto` wrapper, never the page.
- **Test matrix**: 360 / 390 / 768 / 1024 / 1440. Verify no layout shift on the fold.

## 6. Accessibility (WCAG 2.2 AA — acceptance criteria)

- **Landmarks & semantics**: one `<h1>`/page, ordered headings, `<nav aria-label>`, `<main id="main">`, `<article>` for problems/posts, `<time datetime>`, real `<button>`/`<a>` (Radix already gives correct roles/focus).
- **Skip link** to `#main`; visible focus ring (`--ring`); logical tab order.
- **Keyboard**: everything operable; ⌘K palette; Radix menus/dialogs already trap focus + `Esc`.
- **Contrast** ≥4.5:1 text / 3:1 UI — validate both themes (the token set above passes).
- **Forms**: `<label htmlFor>`, `aria-describedby` for errors, `aria-invalid`, inline Zod messages.
- **Live regions**: AI streaming panel `aria-live="polite"`; toasts announced.
- **Reduced motion**: gate framer-motion with `useReducedMotion()`; disable heatmap/roadmap animations.
- **Images**: meaningful `alt`; decorative `alt=""`. **Icons** (lucide) get `aria-hidden` + adjacent text or `aria-label`.
- **CI gate**: `@axe-core/playwright` on key templates; Lighthouse a11y ≥95 (doc 12).

## 7. Dark mode

- `next-themes` already installed. Root `<html suppressHydrationWarning>` (present), `class` strategy, `defaultTheme="system"`, no flash (inline script from next-themes).
- All color decisions go through CSS variables (§1) — never hard-code hex in components; use `bg-background text-foreground border-border` etc.
- **Dark-mode-correct assets**: OG images, logos, code themes (Shiki: `github-light`/`github-dark` dual). Difficulty colors tuned per theme (§1).
- `<meta name="theme-color">` already set per scheme in `viewport` — keep.

## 8. UI/UX upgrades (highest impact)

1. **⌘K command palette** — jump to any problem/topic/company, run actions (SearchAction-backed; also the on-site search UX).
2. **Faceted problem browser** — sticky filters, URL-synced (`?topic=&difficulty=&company=`) so filtered views are shareable *and* indexable.
3. **Progressive disclosure on problem pages** — hints/solution behind intentional reveals (protects learning + creates sign-in CTAs).
4. **Empty/loading/error states** — you have `empty-state`, `skeletons`, `error-boundary`; extend to every new surface. Streaming Suspense boundaries for perceived speed.
5. **Micro-interactions** — solved checkmark burst, streak flame, XP toast (framer-motion, reduced-motion aware).
6. **Consistent page scaffolding** — `PageHeader` (exists) + breadcrumb + right-rail TOC on content pages.

➡ Continue to **[07-seo.md](./07-seo.md)**.
