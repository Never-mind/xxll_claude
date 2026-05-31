# Quotation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable foreign-trade product and quotation system from `kaifa.md`.

**Architecture:** A NestJS API owns Excel persistence, import/export, and all quotation calculations. A React app calls the API for product, tariff, quotation, and history workflows. Shared TypeScript interfaces keep client and server field names aligned.

**Tech Stack:** React 19, Vite, TypeScript, NestJS 10, xlsx, Vitest.

---

### Task 1: Project Skeleton

**Files:**
- Create: `server/tsconfig.json`
- Create: `server/main.ts`
- Create: `server/app.module.ts`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `shared/api.interface.ts`

- [x] Write package scripts for dev, test, and build.
- [x] Add TypeScript configs and entrypoints.
- [x] Add client routing shell and API helper.

### Task 2: Excel Storage And CRUD API

**Files:**
- Create: `server/common/excel-storage.service.ts`
- Create: `server/common/excel-utils.ts`
- Create: `server/common/write-auth.guard.ts`
- Create: `server/modules/product/*`
- Create: `server/modules/tariff-rate/*`
- Create: `server/modules/history-quotation/*`

- [x] Implement `readTable`, `writeTable`, `query`, `insert`, `update`, `delete`, and `paginate`.
- [x] Implement product, tariff, and history CRUD.
- [x] Implement xlsx import/export.
- [x] Add simple write auth guard using `WRITE_AUTH_TOKEN` when configured.

### Task 3: Quotation Calculation

**Files:**
- Create: `server/modules/quotation/quotation-calculator.ts`
- Create: `server/modules/quotation/quotation-calculator.spec.ts`
- Create: `server/modules/quotation/quotation.service.ts`
- Create: `server/modules/quotation/quotation.controller.ts`

- [x] Write a failing Vitest test for CIF/DDP/revenue/public fee allocation.
- [x] Implement the calculator.
- [x] Wire quotation create/update/list/detail/export endpoints.
- [x] Sync completed quotations to history.

### Task 4: Frontend Workflows

**Files:**
- Create: `client/src/api.ts`
- Create: `client/src/styles.css`
- Create: `client/src/pages/*.tsx`

- [x] Build product, tariff, quotation generation, quotation list/detail, and history pages.
- [x] Support search, pagination, modal forms, delete, import, and export where applicable.
- [x] Add quotation summary and calculated detail tables.

### Task 5: Verification

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start dev server and visually verify the app loads.
