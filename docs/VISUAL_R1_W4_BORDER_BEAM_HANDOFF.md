# VISUAL-R1 / Worker 4 — Border Beam (VISUAL-BORDER-01)

Status: **ISOLATED IMPLEMENTATION / DRAFT / AWAITING FOUNDER AESTHETIC APPROVAL**.

## Scope, base and independence

- Repository: `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- Branch: `visual-w4-border-beam-01` based on verified `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35` (2026-10-14).
- Coordination memorial: [PR #290](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/290) (DRAFT). It is intentionally **not** merged or modified here.
- Ownership: Worker 4 owns only `components/visual/EmprovexBorderBeam*`, its demo, a development-only laboratory route, this handoff, and the focused E2E spec.
- No modifications to the Home, Dashboard, other workers' assets, auth, Firestore Rules, Firebase, Vercel, billing, dependencies or production data.

## Reference and license

Reference author: Jakub Antalik. Upstream source: https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/border-beam (`border-beam`, package version `1.4.1` at the time of audit). Demo: https://libraries.dev/beam. Upstream license: MIT, preserved verbatim in `components/visual/LICENSE.border-beam-MIT.txt`.

The upstream offers rotate (`sm`/`md`/`line`) and pulse (`pulse-inner`/`pulse-outside`) families, palettes including `mono`, strengths, duration, dark/light support, and offscreen-pause behavior. Its full implementation uses generated layered CSS and, for pulse, a shared JavaScript frame driver. **This worker does not install or copy the upstream package.** It implements an intentionally simpler, monochrome, masked conic-gradient perimeter with CSS-only movement and React visibility bookkeeping. It is an institutional interpretation, not a pixel-identical upstream port. No JS animation loop or WebGL.

If fidelity to a particular upstream preset is required later, Worker 5 must first secure review and centrally coordinate any new dependency with Worker 1; never silently edit package manifests in W4.

## Files and controls

| File | Purpose |
| --- | --- |
| `components/visual/EmprovexBorderBeam.tsx` | Isolated reusable wrapper; typed API; visibility pause |
| `components/visual/EmprovexBorderBeam.module.css` | Two 1px decorative layers, mask, slow monochrome animation |
| `components/visual/EmprovexBorderBeamDemo.tsx` | Three strengths, theme toggle, pause toggle, button and focus examples |
| `components/visual/EmprovexBorderBeamDemo.module.css` | Self-contained responsive gallery |
| `components/visual/LICENSE.border-beam-MIT.txt` | Upstream attribution and license |
| `app/visual-lab/border-beam/page.tsx` | **Development-only** route; always `notFound()` in production-mode builds, including Preview |
| `tests/e2e/visual-border-beam-lab.spec.mjs` | E2E interaction/responsive/reduced-motion checks (dev server) |

Example (for review only, NOT yet installed in operational components):

```tsx
import { EmprovexBorderBeam } from '@/components/visual/EmprovexBorderBeam';

<EmprovexBorderBeam theme="dark" intensity="low" variant="travel" duration={24} borderRadius={16}>
  <div className="rounded-2xl">Indicador prioritário</div>
</EmprovexBorderBeam>
```

API: `variant: 'travel' | 'focus' | 'static'`, `intensity: 'low' | 'medium' | 'high'`, `duration` (seconds, clamped to 10–60; default 24), `active` (default true), `theme: 'dark' | 'light'`, `borderRadius` (px, clamped 0–64), `reducedMotion` (force static), `pauseWhenOffscreen` (default true), `className`, `style`, `testId`.

**Recommended setting: `intensity="low"`, `duration={24}`, 1px border, monochrome, apply to at most one or two high-priority informational cards per view after approval.** Medium/high are comparative samples only. For buttons, first confirm that the extra wrapper does not change flex sizing or keyboard semantics in context; the wrapped button remains the native interactive element.

## Accessibility and runtime safeguards

- Both decoration layers use `pointer-events: none` and never carry semantic state.
- The content is a normal descendant; keyboard tabbing, focus rings and accessible text remain unchanged.
- Focus variant is a stationary accent shown on `:focus-within`, not the only focus indicator.
- User's `prefers-reduced-motion: reduce` and explicit `reducedMotion` remove animation; mobile widths `<=640px` disable animation.
- `IntersectionObserver` (when supported) pauses offscreen travel; document visibility pauses background tabs. The permanent hairline remains visible. No interval, frame loop or continuous JS work.
- Absolutely positioned 1px ring is clipped to the wrapper perimeter; no external blur, bloom or overflow, and no overlap with menus/tooltips/modals. The wrapper does not impose a `z-index`/portal or change layout dimensions.
- Never use animation alone to indicate severity, errors, or success; preserve semantic badges/labels.

## Manual and automated QA (no production deployment)

1. Locally: `npm ci`, `npm run typecheck`, `npm run build`, then `git diff --check`.
2. Start `npm run dev` and visit `/visual-lab/border-beam` (this is intentionally unavailable in production-mode builds). Compare the three intensities in dark/light; recommendation is LOW.
3. Run `npx playwright test tests/e2e/visual-border-beam-lab.spec.mjs` **with an existing Playwright baseURL pointing to the local dev server**, or supply a local `--config` in a disposable workspace; do not change shared config for this worker.
4. Test 390px, 768px and 1440px widths. Check no horizontal overflow, no displaced hitboxes, native focus navigation, mouse and keyboard click, paused state and reduced-motion.
5. Verify `git diff` includes only W4-owned files and confirm the PR remains DRAFT. Do not merge or publish to production.

## Handoff

**ONDE ESTAMOS:** W4 isolated implementation in `visual-w4-border-beam-01`; draft PR to `main`, with no operational integration.

**O QUE ESTAMOS FAZENDO:** Reusable Border Beam and independent visual demonstration; low/medium/high comparisons.

**QUEM ESTÁ FAZENDO:** Worker 4.

**O QUE FAZER A SEGUIR:** Founder reviews aesthetics; coordinator checks performance and overlap; Worker 5 may integrate only approved variant on a small subset of cards via controlled PR.

**QUEM FARÁ:** Founder / VISUAL-R1 Coordinator / Worker 5.

STOP: no merge, production deploy or modification of F05/F06/F09 or frozen RC.
