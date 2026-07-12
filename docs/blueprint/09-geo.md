# 09 · GEO — Generative Engine Optimization

Covers **#9 GEO (ChatGPT/Gemini/Claude/Perplexity) · #68 AI-search-friendly content · #65 EEAT.** GEO = optimizing to be **retrieved, understood, and cited** by AI answer engines. SEO gets you into the index; GEO gets you into the answer.

---

## 1. How GEO differs from SEO (and why it needs its own strategy)

| | SEO | GEO |
|---|---|---|
| Unit of success | A ranked *link* | A *cited sentence/claim* |
| Reader | Human who clicks | LLM that extracts, then a human who may click the citation |
| Wins with | Keywords, backlinks, CWV | Extractable facts, clear structure, authority, freshness, being in the training/retrieval set |
| Format that wins | Skimmable pages | **Self-contained, quotable, factual chunks** |

Two retrieval paths to optimize for:
1. **Live retrieval** (Perplexity, ChatGPT Search/SearchGPT, Google AI Overviews, Gemini grounding, Claude web) — they crawl/fetch in real time. Governed by crawler access + on-page extractability.
2. **Training corpus** (base model knowledge) — governed by being *widely present and cited* across the web over time (backlinks, mentions, Common Crawl inclusion). Slower, compounding.

---

## 2. Crawler access — let the AI in (foundation)

Already handled in `robots.ts` (doc 07): explicit `allow` for **GPTBot, OAI-SearchBot, ChatGPT-User** (OpenAI), **ClaudeBot, Claude-Web** (Anthropic), **PerplexityBot** (Perplexity), **Google-Extended** (Gemini/Vertex training), **Applebot-Extended**, **CCBot** (Common Crawl → feeds many models).

- **Decision:** allow them (you *want* citations). Only block if you're protecting paywalled/original content — then block just those paths, keep the free reference layer open.
- Ensure no Vercel/WAF/bot-fight rule silently 403s these agents (test with their UA strings). Publicly server-render content (no JS-gated text) so live crawlers get the full answer.

### `llms.txt` — the AI-crawler manifest — `src/app/llms.txt/route.ts`

An emerging convention (like robots for LLMs): a curated, link-rich map of your best content.

```ts
import { SITE } from "@/lib/seo";
export const dynamic = "force-static";
export async function GET() {
  const body = `# ${SITE.name}
> ${SITE.description}

DSAspire is a free DSA learning and interview-prep platform: 15,000+ curated problems,
visual roadmaps, pattern-based guides, a CP-grade algorithm reference, company interview
hubs, and AI tutoring.

## Algorithms (reference)
- [Dijkstra's Algorithm](${SITE.url}/algorithms/dijkstra): shortest path, O(E log V)
- [Kadane's Algorithm](${SITE.url}/algorithms/kadane): max subarray, O(n)
- [Union-Find (DSU)](${SITE.url}/algorithms/union-find): near-O(1) with path compression
… (generated from published Content type=algorithm)

## Patterns
- [Sliding Window](${SITE.url}/patterns/sliding-window)
- [Two Pointers](${SITE.url}/patterns/two-pointers)
… (from lib/patterns.ts)

## Topics
- [Dynamic Programming](${SITE.url}/topics/dynamic-programming)
…

## Full index
- Sitemap: ${SITE.url}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
```
Also publish `llms-full.txt` (concatenated key reference articles as clean Markdown) for models that ingest a single-file corpus.

---

## 3. Content structure that gets cited (#68)

LLMs preferentially extract **self-contained, factual, well-labeled chunks**. Bake these into every content template (doc 06 components already include the slots):

1. **Answer-first (BLUF).** Open every page/section with a 1–2 sentence direct answer *before* elaboration. The `AnswerBlock` component renders a bolded lead: *"A monotonic stack is a stack whose elements stay sorted; it solves next-greater/smaller-element queries in O(n)."* → this exact sentence is what gets quoted.
2. **Question-shaped H2/H3s.** "When should I use a sliding window?", "What is the time complexity of Dijkstra?" Mirrors real prompts → high retrieval match. (DesignGurus/SO do this.)
3. **Definitions up top**, one concept per paragraph, term in **bold** first use → drives glossary + AI definitional answers.
4. **Facts as tables.** Complexity tables (time/space/best/worst), comparison tables (BFS vs DFS). Tables are highly extractable and quotable verbatim.
5. **Standalone statements.** Avoid "as we saw above / it" — each sentence should be true out of context (LLMs chunk mid-page).
6. **Code with language + complexity annotation**, minimal and correct, one canonical solution per language. Correctness matters: wrong code that gets cited destroys trust.
7. **Key Takeaways / TL;DR list** at top or bottom (the `KeyTakeaways` component) — models love bulletable summaries.
8. **Numbers and specificity.** "15,000+ problems", "O(V+E)", "reduces revisions by spacing at 1/3/7/16 days" — concrete figures get cited over vague claims. (Research on GEO shows *statistics, citations, and quotations* measurably raise inclusion.)
9. **FAQ blocks** (rendered + FAQ schema) — the single most reliable Q→A extraction surface.
10. **Freshness signals** — visible "Last updated {date}" + `dateModified` schema; recency boosts inclusion in live-retrieval answers.

**Template contract:** every `(content)` page ships → AnswerBlock (BLUF) · question-shaped headings · ≥1 table · KeyTakeaways · FAQ · visible last-updated · clean semantic HTML. This is an acceptance checklist, not a suggestion.

---

## 4. EEAT — Experience, Expertise, Authoritativeness, Trust (#65)

AI engines and Google both weight source authority. Build the signals:

- **Named authors with credentials.** `Author` model (doc 04) → visible byline + `/authors/[slug]` bio + `Person` schema + "Written by / Reviewed by". This is what makes takeuforward (Striver) and NeetCode citeable.
- **Reviewed-by / verified** line on technical articles ("Reviewed by an ex-FAANG engineer; solution verified against N test cases", `lastVerifiedAt`).
- **Proof-of-work corpus** — public profiles, contribution heatmaps, and user solution galleries create real E (Experience) signals and long-tail pages.
- **Original data & research** — publish *your own* datasets/analyses ("We analyzed 15,267 problems: here are the 20 most-asked-at-Google patterns"). Original stats attract backlinks *and* get quoted by LLMs (nobody else has the number).
- **Citations & references** — link primary sources (papers, CLRS, official docs) on algorithm pages; being a well-referenced hub raises authority.
- **Consistent entity** — same NAP/brand, `sameAs` links, Wikidata/Wikipedia presence over time, Organization schema. Helps engines resolve "DSAspire" to a known entity.
- **Trust basics** — HTTPS, privacy/terms, contact, no intrusive interstitials, accurate content, corrections policy.

---

## 5. Per-engine tactics

| Engine | How it retrieves | DSAspire play |
|---|---|---|
| **ChatGPT / SearchGPT** (GPTBot, OAI-SearchBot) | Live search + training corpus; favors clear, authoritative, structured pages | Allow crawlers, `llms.txt`, answer-first + schema; earn mentions on Reddit/GitHub/SO (training signal). |
| **Perplexity** (PerplexityBot) | Real-time retrieval, cites 3–6 sources, loves fresh + factual + list/table content | Tables, "Top N" lists, FAQs, fresh `dateModified`; concise citeable sentences. Highest near-term ROI — Perplexity cites quickly. |
| **Google AI Overviews / Gemini** (Googlebot + Google-Extended) | Built on your existing Google index + grounding; passage-level | Rank well classically (doc 07) + FAQ/HowTo/Course schema + passage-friendly headings. AI Overviews pull from top-ranking, well-structured pages. |
| **Claude (web search)** (ClaudeBot, Claude-Web) | Live fetch + training; values clean, trustworthy, well-structured text | Semantic HTML, EEAT, `llms-full.txt`; correctness and clarity over keyword stuffing. |

**Universal levers (help all four):** be crawlable, be server-rendered, be structured (schema), be authoritative (EEAT), be factual/quotable, be fresh, and be *mentioned across the web* (off-site presence is the biggest training-corpus lever).

---

## 6. Off-site GEO (the compounding half)

Being cited by AI correlates strongly with being *widely referenced*:
- Publish canonical reference content others link to (CP-Algorithms is cited because everyone links it).
- Seed authoritative mentions: high-quality answers on Stack Overflow/Reddit linking your reference pages, a well-starred GitHub repo (your `dsa-question-db` dataset can be an open, citeable resource), guest posts, dev.to/Medium cross-posts with canonical back to you.
- Get into **Common Crawl** (public, server-rendered pages do this automatically) → feeds future model training.
- Encourage embeds/shares (roadmap.sh-style shareable roadmaps, Excalidraw-style diagrams) → backlinks.

---

## 7. Measuring GEO

- **Referral analytics** — segment sessions from `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `claude.ai` referrers / `utm_source` (doc 12). Rising AI-referral sessions = citations landing.
- **Server-log crawler hits** — track GPTBot/ClaudeBot/PerplexityBot fetch volume + which URLs (proxy for retrieval interest).
- **Prompt panel** — a monthly manual/automated check: ask each engine a set of target queries ("best way to learn dynamic programming", "Google DP interview questions", "what is a monotonic stack") and record whether DSAspire is cited. Track share-of-voice over time.
- **Branded-query lift** in Search Console (people searching "DSAspire" after seeing citations).

**Target:** within 2 quarters of P3, DSAspire cited by Perplexity/ChatGPT for ≥20 head DSA queries; AI-referral sessions a measurable, growing channel.

➡ Continue to **[10-content-strategy.md](./10-content-strategy.md)**.
