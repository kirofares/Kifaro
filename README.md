# KIFARO

KIFARO is a medical education platform for undergraduate medical students.

## Current MVP
- Student Dashboard
- Curriculum
- AnatoMate by KIFARO
- Topics
- Interactive Learning Room
- KIFARO Studio
- My Library / Favorites
- English + Arabic UI
- RTL support
- Four color themes
- Progress and preferences saved with localStorage
- Responsive desktop/tablet/mobile layout

## Stack
React + TypeScript + Vite + React Router + Lucide Icons

## Run locally
Use Node.js 22.13 or newer. CI and release workflows use Node.js 22 and the
committed lockfile, so they install the same dependency versions.

```bash
npm ci
npm run dev
```

## Quality checks
```bash
npm run test:guardian
npm run test:viva
npm audit --omit=dev --audit-level=high
npm run typecheck
npm run build
```

PptxGenJS 4.0.1 still requests the vulnerable image-size 1.x series. The scoped
override selects patched image-size 2.0.4; keep it until an upstream release
uses a patched version. Guardian tests exercise the actual PDF/PPTX exporters,
PDF rendering, and a malformed-image regression. A missing or failed audit
also fails the pull request, rather than waiting for the scheduled run.
