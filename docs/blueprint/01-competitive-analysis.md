# 01 · Competitive Analysis → Actionable Playbook

Distilled from the 22 reference sites. Each row is **the specific mechanic worth copying**, not a description. "Adopt" = what DSAspire should ship.

---

## 1. Per-site teardown (what they do best)

### Content & SEO powerhouses
| Site | What makes it win | Adopt in DSAspire |
|---|---|---|
| **leetcode.com** | Canonical problem URLs `/problems/two-sum/`; each problem is an indexable entity with structured constraints, examples, tags, companies, difficulty; discuss + solutions long-tail. | Public problem pages at `/problems/[slug]` with identical structure + `Question`/`TechArticle` schema. |
| **geeksforgeeks.org** | Massive programmatic + editorial footprint; every algorithm/data-structure has a pillar page; aggressive internal linking; "Related Articles" blocks; ranks for definitional queries. | Pillar pages per topic/pattern + "Related" internal-link blocks; own definitional queries ("what is a monotonic stack"). |
| **takeuforward.org** | Striver's **A2Z sheet + SDE sheet** as the spine; each step links to article + video + practice; strong topic clustering; personality/EEAT (Striver as author). | Sheet-as-spine model already partly present — make sheets **public**, link step→guide→video→practice; add named authors. |
| **neetcode.io** | **Roadmap graph** (visual dependency DAG) as the hero; curated 150/250; per-problem video solution; clean free/pro split. | Visual roadmap pages (`/roadmaps/[slug]`) as an interactive DAG; curated lists; solution pages. |
| **interviewbit.com** | Structured **programs/tracks**; company-wise pages; "interview experience" UGC; gamified progress. | Track structure + company hubs + interview-experience content type. |
| **algo.monster** | **Pattern-first** teaching ("templates"), flowchart "which algorithm to use", tight paywall funnel; excellent for pattern long-tail. | Pattern explainer pages with reusable code templates + a "decision flowchart". |
| **educative.io** | Text-first interactive courses (no video), in-browser widgets, "answer boxes", course schema, heavy topic clustering. | Interactive text lessons with runnable snippets; `Course` schema. |
| **designgurus.io** | "Grokking" pattern courses; Q&A-shaped lesson titles; strong on *system-design + coding patterns* SEO. | Q&A-shaped headings on every lesson (great for GEO). |

### Competitive-programming references (deep, trusted, highly AI-cited)
| Site | What makes it win | Adopt |
|---|---|---|
| **cp-algorithms.com** | The canonical algorithm reference; clean semantic HTML, math, complexity, source; **extremely cited by LLMs**. | An `/algorithms/[slug]` reference layer: definition → intuition → proof sketch → complexity → reference implementation. This is your **GEO moat**. |
| **cses.fi** | The **CSES Problem Set** — a fixed, canonical, curated ladder people bookmark and reference. | A canonical, versioned "DSAspire 300" ladder with stable slugs. |
| **codeforces.com** | Rating system, contests, editorials, blogs, problem tags/difficulty; huge engaged community; problem ratings are a citeable standard. | Difficulty **rating numbers** (not just Easy/Med/Hard), editorials, contest archive. |
| **atcoder.jp** | Clean contest cadence, difficulty color-tiers, beginner→advanced ladders. | Color-tiered difficulty; beginner ladders. |
| **codechef.com** | Learning paths + practice + contests bundled; "DSA learning series". | Bundled learn→practice→contest journey. |
| **hackerrank.com** | Skills **certifications**, domain tracks, interview-prep kits; ranks for "X interview questions". | Skill tracks + an "interview prep kit" curated bundle; certification later. |
| **hackerearth.com** | Practice + hiring assessments; topic tutorials with editorials. | Tutorial+editorial pairing per topic. |
| **workat.tech** | Tight **interview-prep** framing (CS fundamentals, mock interviews, "cracking the coding interview" structure), clean UX. | Interview-prep framing and mock-interview product. |

### UX / platform patterns
| Site | What makes it win | Adopt |
|---|---|---|
| **github.com** | Contribution **heatmap** (proof-of-work), profile READMEs, achievements, star/follow graph, flawless dark mode, command-k. | Heatmap already present → make profiles **public & shareable**; add achievements, ⌘K palette. |
| **stackoverflow.com** | Q&A schema, canonical questions, reputation, "linked/related", accepted-answer rich snippets; **the** GEO-cited format. | `/interview-questions/[slug]` in Q&A format with `QAPage` schema. |
| **roadmap.sh** | Visual, forkable **roadmaps**; SVG/interactive nodes; each node → resources; huge shares/backlinks. | Interactive roadmap renderer with per-node drawers linking to your content. |
| **excalidraw.com** | Instant, frictionless diagramming; embeddable. | Embed a lightweight whiteboard in mock-interview + notes. |
| **frontendmentor.io** | Challenge → submission → feedback loop; community solutions gallery. | Community solutions gallery per problem (UGC → long-tail + freshness). |
| **binarysearch.com** | Real-time collaborative rooms, streaks, minimalist solve UI. | Collaborative mock-interview room. |

---

## 2. Cross-cutting patterns the winners share

**Content model (the SEO engine):**
1. **Entity-per-URL.** Every problem, topic, pattern, algorithm, company = one stable, canonical URL. This is the atomic unit of both SEO and GEO.
2. **Hub-and-spoke topic clusters.** A pillar page (`/topics/dynamic-programming`) links to N spokes (subtopics, patterns, problems, guides); spokes link back. (Detail → doc 10.)
3. **Multiple content types per entity.** LeetCode two-sum has: problem + editorial + solutions + discuss. More indexable surface, more internal links, more freshness.
4. **Programmatic + editorial blend.** GfG/LeetCode scale with templates; takeuforward/NeetCode win trust with authored depth. Do both.

**Trust / EEAT (why they get cited):**
5. **Named authors & credentials** (Striver, NeetCode). Bylines, author pages, `Person` schema.
6. **Canonical, versioned, stable references** (CP-Algorithms, CSES). LLMs prefer sources that don't move.
7. **Community proof** (SO reputation, GH contributions, CF ratings). Social proof = ranking + citation signal.

**Engagement / retention loop:**
8. **Streaks + heatmap + achievements** (GH, LeetCode, Duolingo-style). You already have the heatmap — wire it to a public profile.
9. **Curated ladders** (Blind 75, NeetCode 150, CSES, Striver A2Z) as commitment devices.
10. **Contests + leaderboards** (CF/AtCoder/CC) for recurring return visits.

**GEO (AI-answer optimization) — see doc 09:**
11. **Answer-first, question-shaped headings** (SO, DesignGurus). LLMs extract Q→A pairs.
12. **Clean semantic HTML + tables + code + complexity** (CP-Algorithms). Machine-parseable = machine-citeable.
13. **Definitional clarity up top** ("A monotonic stack is…"). Own the definition, get quoted.

---

## 3. Feature parity + differentiation matrix

| Capability | LeetCode | NeetCode | GfG | takeuforward | **DSAspire target** |
|---|:--:|:--:|:--:|:--:|:--:|
| Public problem pages | ✅ | ✅ | ✅ | ✅ | ✅ **new** |
| Visual roadmaps | ❌ | ✅ | ❌ | ⚠️ | ✅ interactive DAG |
| Pattern-first teaching | ❌ | ⚠️ | ⚠️ | ✅ | ✅ 163 patterns |
| Company interview hubs | ✅(pro) | ❌ | ✅ | ⚠️ | ✅ **new** |
| Spaced-repetition revision | ❌ | ❌ | ❌ | ❌ | ✅ **differentiator** |
| AI doubt/hints/review | ⚠️ | ❌ | ⚠️ | ❌ | ✅ **differentiator** |
| AI mock interviews | ❌ | ❌ | ❌ | ❌ | ✅ **differentiator** |
| Public proof-of-work profile | ✅ | ❌ | ❌ | ❌ | ✅ |
| CP-grade algorithm reference | ❌ | ❌ | ⚠️ | ❌ | ✅ **GEO moat** |
| WhatsApp study reminders | ❌ | ❌ | ❌ | ❌ | ✅ **already have** |

**DSAspire's defensible wedge = the four differentiators:** spaced-repetition revision + AI tutor suite + AI mock interviews + a CP-grade, AI-citeable reference layer — bundled with a public content plane for discovery. Nobody in the list combines all four.

➡ Continue to **[02-architecture-ia.md](./02-architecture-ia.md)**.
