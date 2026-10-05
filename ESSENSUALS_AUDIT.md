# Essensuals — Production Audit (HR / Payroll / Finance / Billing Integration)

Date: 2026-09-24
Scope: full-system audit per request, focused on HR, payroll, finance, billing↔finance integration, and service/product/membership/cashback separation.
Method: direct code reading (`src/lib/api.js`, all `src/pages/admin/*.jsx`, `src/layouts/AdminLayout.jsx`) + full-text review of every `supabase/*.sql` file. No files were modified during the audit. Every finding below cites file:line evidence; nothing is speculative.

**Stack note (important context for every finding):** This is a React + Vite SPA that talks **directly** to Supabase Postgres from the browser using the public `anon` key — there is no custom backend server. That means **Postgres Row Level Security (RLS) is the only real authorization boundary**; any role/permission check written in React is cosmetic and can be bypassed by calling the Supabase REST API directly.

**Schema drift warning:** The committed `supabase/*.sql` files do **not** contain `CREATE TABLE staff_payments`, `CREATE TABLE staff_advances`, or the `base_salary` column on `staff` — these exist only as RLS-policy targets in `fix-all-rls-policies.sql`. The live production schema was evidently built out-of-band (Supabase dashboard, or an uncommitted migration). This means DB-level constraints (uniqueness, FK cascade behavior) referenced below are **inferred from application behavior**, not confirmed from a `CREATE TABLE` statement, and are flagged as such.

---

## 1. Executive Summary

The audit found **12 Critical** and **9 High** severity issues. The single most consequential fact: **there is no authorization model in this application at all.** Every Supabase RLS policy on every financial/HR table is `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — meaning any staff member who can log in has full read/write access to every other employee's salary, every customer's data, all expenses, and all invoices, with no server-side restriction. One ledger table (`wallet_transactions`, the cashback/recharge ledger) is writable by **unauthenticated** users.

On the financial-correctness side, the two headline business rules the requester emphasized are both currently violated in production:
- **LOP/absent-day deduction is not implemented at all** — `days_present` is computed, stored, and displayed, but never subtracted from salary. Absent staff are paid in full.
- **Membership revenue leaks into the "service" bucket** used for staff performance/incentive figures in `StaffManager.jsx` and `StaffProfile.jsx` — directly contradicting the "service-only incentive" rule, even after a recent in-progress fix (`isProductItem()`) that only addressed the product side, not membership, and was never wired into the invoice write path or the reporting pages.

Payroll and Finance integration is *mostly* correctly designed (salary and advances do post to Finance automatically, with traceability via `source_id`), but the salary-expense creation is **not idempotent** — a network retry after a partial failure can silently double-book a salary expense with no error surfaced to the user.

None of this requires a rewrite. Every issue below has a small, targeted fix. Several — LOP enforcement, overtime, allowances, partial advance recovery across months, and the refund/void workflow — are **not bugs but unimplemented business rules**, and are flagged `BUSINESS RULE REQUIRES CONFIRMATION` rather than assumed.

---

## 2. Architecture

- **Frontend:** React 18 + Vite, React Router. Public site (`src/pages/public/*`) and an admin SPA (`src/pages/admin/*`) mounted separately (`src/main.jsx` / `src/admin-main.jsx`, `src/App.jsx` / `src/AdminApp.jsx`).
- **Backend:** none. `src/lib/supabase.js` creates a Supabase client with the `anon` key (`VITE_SUPABASE_ANON_KEY`); all reads/writes go straight from the browser to Postgres via PostgREST.
- **Data layer:** `src/lib/api.js` (1806 lines) — every query, mutation, and business calculation in the app funnels through this one file.
- **Auth:** Supabase Auth (`supabase.auth.signInWithPassword`), session-only gate in `AdminApp.jsx` (`RequireAuth`). No role/permission table is consulted at login or anywhere else.
- **State:** `AdminLayout.jsx` loads ~23 tables in one `fetchAdminData()` call on mount and exposes them via a `useAdmin()` context; every admin page reads from this shared cache instead of querying independently (this part is well-designed — see §13).
- **Database:** Supabase Postgres. Schema is fragmented across ~10 loose SQL files in `supabase/` with no clear single source of truth, plus at least one migration under `supabase/migrations/`; several tables central to this audit (`staff_payments`, `staff_advances`) have no committed `CREATE TABLE` at all.

### Verified data flow

| Claimed connection | Verified? | Evidence |
|---|---|---|
| Billing → Sales → Finance | **Yes** — revenue is derived live from `invoices`, no manual duplicate entry | `api.js:1094-1173` (`buildAnalytics`), `FinanceManager.jsx:484-487` |
| Attendance → Payroll | **Partially** — `days_present` flows into `staff_payments` but is never used in `net_payable` math | `StaffManager.jsx:356,384,472` |
| Staff → Salary calculation | **Yes, but fragile** — keyed by free-text `staff_name`, not `staff_id`, for revenue attribution | `StaffManager.jsx:220,242-243,260-262` |
| Payroll → Salary expense | **Yes** — `markSalaryPaid` auto-creates a traceable Finance expense | `api.js:1606-1632` |
| Products/stock → Product/stock cost | **No** — purchases never create a Finance expense | confirmed absent in `InventoryManager.jsx` |
| Expenses → Finance | **Yes** (trivially, they're the same table) | `FinanceManager.jsx` |
| Finance → Dashboard | **Yes** | `Dashboard.jsx`, `AnalyticsDashboard.jsx` |

---

## 3. Critical Bugs (cross-cutting, highest severity)

See §16 fix plan and the Top 10 list (§18) for the ranked, actionable version. Full detail organized by module in §4–§12 below.

---

## 4. Payroll Issues

### PAY-01 — `base_salary` retroactively overwritten on unpaid historical payroll rows
- **Severity:** Critical (data corruption)
- **File/Function:** `StaffManager.jsx:378-386` (line 380), inside `handleGenerateWorksheet`
- **Root cause:** When "Generate Month Worksheet" is re-run for a month that already has an **unpaid** `staff_payments` row, the code unconditionally overwrites `base_salary: s.base_salary` — the staff's **current** salary — rather than preserving the salary that was in effect for that historical period.
- **Evidence:** `base_salary` is only "snapshotted" correctly the first time a row is created; every subsequent regeneration re-reads the live `staff.base_salary`.
- **Business impact:** Admin raises a staff member's salary mid-year; if last month's payroll was never marked paid and the worksheet is regenerated for any reason, that unpaid month silently gets the new (wrong) salary.
- **Recommended fix:** Only set `base_salary` when creating a **new** `staff_payments` row; never overwrite it on an existing (even unpaid) row during regeneration.
- **Test required:** Create unpaid payroll row for month M with salary X; change staff salary to Y; regenerate worksheet for month M; assert `base_salary` is still X.

### PAY-02 — No partial-month/joining-date proration
- **Severity:** Medium — `BUSINESS RULE REQUIRES CONFIRMATION`
- **Evidence:** `joining_date` is display-only; grep confirms zero references in any salary computation.
- **Note:** Not a bug per se — flat monthly salary regardless of join date may be intentional. Needs business confirmation before any change.

### PAY-03 — No automatic Product/Target Incentive formula
- **Severity:** Medium (process gap, not corruption)
- **File:** `StaffManager.jsx:690,744-749` (manual `incentives` input) vs. `StaffManager.jsx:206-308` (Performance tab's computed `serviceSales`/`productSales`, never wired to payroll)
- **Finding:** "Incentives" in payroll is a single plain manually-typed number with zero formula, no product/target split, no threshold logic. The Performance tab computes real sales figures but they never feed the payroll field.
- **Business impact:** Because it's manual, there's no duplicate-incentive risk — but it also means product-vs-service misclassification bugs (§6) only corrupt what the admin *looks at* when deciding the number, not (yet) an automated calculation.
- **BUSINESS RULE REQUIRES CONFIRMATION:** exact incentive formula (percentage? tiered? target-based?) is not defined anywhere in code.

### PAY-04 — Overtime: entirely unimplemented
- **Severity:** `BUSINESS RULE REQUIRES CONFIRMATION`
- **Evidence:** Zero matches for overtime/OT/extra-hours logic anywhere in `src/`. `hoursWorked` is computed for display only (`StaffManager.jsx:226-236`) and never consumed by payroll.

### PAY-05 — Food/Travel Allowance: entirely unimplemented
- **Severity:** `BUSINESS RULE REQUIRES CONFIRMATION`
- **Evidence:** No `food_allowance`/`travel_allowance` field exists on `staff` or `staff_payments` in any schema file, and no UI input exists. The only catch-all field, `other_deductions`, is subtractive and UI-blocked from negative values (`min="0"`, `StaffManager.jsx:766`), so it cannot even be (ab)used to represent a positive allowance.

---

## 5. Salary Calculation Issues

### SAL-01 — LOP / absent-day deduction never applied (see also §7)
Covered in full in §7 (PAY-08) — cross-referenced here because it is the single largest gap in the "Basic Salary … − LOP/Absent Deduction = Net Salary" formula from the brief. **None of the three `net_payable` formulas in the codebase (`StaffManager.jsx:356`, `384`, `472`) reference `days_present` at all.**

### SAL-02 — Revenue/tip attribution keyed on free-text `staff_name`, not `staff_id`
- **Severity:** Critical (silent historical data loss)
- **File/Function:** `StaffManager.jsx:220,242-243,260-262`; `StaffProfile.jsx:49-56,94,167-168,450-451`; root data model: `api.js:415-426` (`saveInvoice` stores `staff_name` as plain text on `invoice_items`, no FK)
- **Root cause:** Every performance/sales/tip figure used to inform payroll incentives is computed by string-matching `invoice_items.staff_name` (trimmed, lowercased) against `staff.name`, instead of a `staff_id` foreign key.
- **Concrete failure scenario A (rename):** Admin fixes a typo in a staff member's name via the staff-edit modal (`updateStaff`, `api.js:1279-1284`). Every historical invoice still has the **old** name string. All past sales/tips/service-count figures for that employee silently vanish from the Performance tab and Profile page — as if they never worked those shifts — even though attendance/payroll (which use real `staff_id` FKs) are unaffected.
- **Concrete failure scenario B (name collision):** Two active staff share a first name (or differ only by trailing whitespace/case that normalizes identically) → their sales/tips are merged in every report.
- **Business impact:** Directly corrupts the input an admin uses to set the (manual) incentive figure, and corrupts all historical reporting after any name edit — with no error, warning, or way to detect it happened.
- **Recommended fix:** Add `staff_id` to `invoice_items` (and backfill from `staff_name` where unambiguous), and switch all attribution logic to match on `staff_id`. This is a schema change — flag for planning, not a one-line patch.
- **Test required:** Rename a staff member with existing invoice history; assert their historical Performance/Profile figures are unchanged.

---

## 6. Salary Advance Issues

### ADV-01 — Advance recovery is a binary status flag, not a running balance
- **Severity:** Critical
- **File/Function:** `api.js:1612-1617` (inside `markSalaryPaid`) + `StaffManager.jsx:757-763` (unguarded manual `advances_deducted` override)
- **Root cause:** `staff_advances` has only `status: 'pending' | 'deducted'` — no `amount_recovered`/`outstanding_balance` field. Recovery is triggered by a **bulk status flip**: `UPDATE staff_advances SET status='deducted' WHERE staff_id=? AND work_month=? AND status='pending'`, which is not aware of any specific amount.
- **Concrete failure scenario:** Worksheet auto-computes `advances_deducted = ₹1000` (matching one pending advance). Admin manually edits it down to ₹500 (intending a partial recovery) and saves. When payroll is later marked paid, `markSalaryPaid` still flips the **entire** ₹1000 advance to `deducted` — the ledger now shows ₹1000 fully recovered while net pay only actually withheld ₹500. Permanent, undetectable ₹500 discrepancy (no balance field exists to reconcile against).
- **Business impact:** Directly violates the brief's explicit example ("system must not deduct ₹10,000 repeatedly" / must track outstanding balance correctly) — the current design has no outstanding-balance concept at all, only fully-pending or fully-deducted.
- **Recommended fix (needs schema change):** Add `amount_recovered numeric` (or a separate `staff_advance_repayments` ledger table) to `staff_advances`; make `markSalaryPaid` deduction amount-aware, not just status-aware.
- **BUSINESS RULE REQUIRES CONFIRMATION:** intended repayment behavior for advances larger than one month's net pay (partial recovery across multiple months) is undefined — current design cannot support it at all.

### ADV-02 — Advance issuance vs. recovery: correctly modeled (no double-counting found)
- **Severity:** N/A — confirmed correct, documented for completeness.
- **Evidence:** `saveStaffAdvance` (`api.js:1635-1661`) books the cash outflow once, at issuance, as its own "Staff Advance" Finance expense. `markSalaryPaid` does **not** create a second expense when the advance is recovered — it only reduces `net_payable`. Total booked expense across both events equals the full month's earned salary exactly once. This is correct double-entry behavior and should be preserved as-is.
- **Minor UX note:** the original "Staff Advance" expense row is never reversed/annotated when recovered, so Finance's category breakdown always shows it as a standing outflow even after recovery — correct accounting, but potentially confusing without a UI note. Low priority.

---

## 7. Attendance / LOP Issues

### PAY-08 — `days_present` computed and stored but never used in salary math
- **Severity:** Critical / `BUSINESS RULE REQUIRES CONFIRMATION` on intent
- **File/Function:** `StaffManager.jsx:356` (`const net = base_salary + tips - advances`), `StaffManager.jsx:384`, `StaffProfile.jsx` mirrors — **none reference `days_present`**.
- **Evidence:** `days_present` is computed as `count(status IN ('present','late'))` in three separate places and is even stored on `staff_payments.days_present` via a dedicated migration (`add-days-present-to-payments.sql`) — strongly suggesting LOP logic was planned but never finished, not that a no-deduction policy was deliberately chosen.
- **Concrete failure scenario:** An employee absent 15 of 26 working days still receives full `base_salary` unless the admin manually estimates and types a reduction into the generic `other_deductions` field — with no guidance and no link to the absence count shown two columns over.
- **Business impact:** This is the exact "LOP / Absent Deduction" component from the brief's payroll formula — currently a no-op. If the business intends attendance-based deduction (which the schema strongly implies), staff are currently being overpaid every month they have unexcused absences.
- **BUSINESS RULE REQUIRES CONFIRMATION:** (a) is LOP deduction actually intended, or is this a flat-salary-plus-incentive model by design; (b) if intended, what counts as a "working day" denominator (no holiday/weekly-off calendar exists — attendance statuses are only `present/absent/late/leave`, with `leave` not distinguished as approved-vs-unapproved anywhere); (c) per-day rate formula (`base_salary / working_days_in_month`?).
- **Recommended fix (once rule confirmed):** Add explicit LOP calculation to the `net_payable` formula, using the confirmed per-day rate and the confirmed definition of a deductible absence.

---

## 8. Finance Issues

### FIN-01 — `markSalaryPaid` salary-expense creation is not idempotent
- **Severity:** Critical (financial double-counting, no error surfaced)
- **File/Function:** `api.js:1606-1632`, specifically the unconditional `expenses` INSERT at line ~1619
- **Root cause:** `markSalaryPaid` performs three sequential, non-transactional writes (mark payment paid → flip advances → insert "Salaries" expense) with **no check that `staff_payments.status` isn't already `'paid'`** before proceeding, and **no unique constraint on `expenses.source_id`**.
- **Concrete failure scenario:** Admin clicks "Reconcile & Payout." Steps 1–2 succeed but the network drops before/during step 3, or the whole call throws after step 3 already committed; the UI's `catch` block just toasts an error and resets `saving=false`, leaving the modal open. Admin clicks the button again. Step 1 and 2 are harmless no-ops on retry, but step 3 fires again unconditionally — **a second identical "Salaries" expense is inserted**, silently double-counting that payout in Finance with no error shown to the user.
- **Recommended fix:** Before inserting the expense, check `staff_payments.status` first (guard the whole function as a no-op if already `'paid'`), and/or add a unique constraint on `expenses(source_id) WHERE is_system_entry = true` as a DB-level backstop. Ideally wrap all three writes in a single Postgres RPC/transaction.
- **Test required:** Call `markSalaryPaid` twice for the same payment id; assert exactly one "Salaries" expense exists afterward.

### FIN-02 — IST/UTC date-boundary inconsistency
- **Severity:** High
- **Files:** `Dashboard.jsx:54-55` (revenue-breakdown modal), `AnalyticsDashboard.jsx:13` (feeds WhatsApp EOD report), `ReportsManager.jsx:21,31` (feeds email EOD report) — all use plain `new Date().toISOString()` (true UTC) — **vs.** `api.js:18-22` (`getISTDate()`, correctly IST-shifted) used for the headline Dashboard KPI tiles and for stamping `invoices.billing_at`.
- **Concrete failure scenario:** Between 00:00–05:29 IST, `getISTDate()`-based figures (the KPI tile) already count a 1 AM sale as "today," while the UTC-based drill-down modal / EOD reports still call it "yesterday" — producing a visible mismatch between the headline number and its own detail view, and potentially a mis-dated automated EOD report for up to 5.5 hours after midnight.
- **Recommended fix:** Replace the three raw `new Date().toISOString()` call sites with the existing `getISTDate()` helper for consistency.
- **Extra:** `FinanceManager.jsx:44-61` (`isTodayOrYesterday`) uses a **third** convention — browser-local time — which only happens to agree with IST if the admin's OS clock is set to IST. Should also be standardized.

### FIN-03 — Inventory/product purchase cost never flows into Finance
- **Severity:** High
- **Files:** `InventoryManager.jsx` (`adjustStock` L120-129) and `saveStockTransfer` (`api.js:1720-1751`) — neither calls `saveExpense`.
- **Business impact:** P&L "Total Outflow Expenses" permanently understates true cost of goods unless an admin remembers to separately, manually log the same purchase in Finance under the (already-seeded but unlinked) "Inventory" category. Dashboard's "Stock Valuation" (`Dashboard.jsx:229`) grows with no corresponding expense ever hitting the books.
- **Recommended fix:** When stock is added via a purchase (not a transfer/adjustment), auto-create a traceable Finance expense in the "Inventory"/"Product Purchase" category, same pattern as `markSalaryPaid`.
- **BUSINESS RULE REQUIRES CONFIRMATION:** should *every* stock addition (including internal transfers/corrections) create an expense, or only ones flagged as an actual purchase? Current UI doesn't distinguish purchase-restock from correction/transfer.

### FIN-04 — Manual expense form hardcodes `payment_method: "Cash"`
- **Severity:** Medium
- **File:** `FinanceManager.jsx:202`
- **Impact:** Any non-cash manual expense (UPI/bank transfer) is mislabeled as Cash, distorting the Cash Register's `expectedCash` reconciliation.
- **Fix:** Expose the existing `payment_method` column as a selectable field on the manual-expense form.

### FIN-05 — No "added by" / `created_by` on manual expenses
- **Severity:** Medium (audit trail gap)
- **Evidence:** `saveExpense` (`api.js:1672-1695`) never records the authenticated user, unlike `saveInvoice` which does capture `created_by` via `supabase.auth.getUser()`.
- **Fix:** Mirror the invoice pattern — capture `auth.getUser()` on expense creation.

### FIN-06 — No path to log a historical/backdated expense
- **Severity:** Medium
- **Evidence:** Manual expenses are only created via the Cash Drawer's "Log Payout" form, which requires an **open register for today or yesterday only** (`isTodayOrYesterday`, gated at `FinanceManager.jsx:137-140,160-163`). There is no standalone "Add Expense" screen for arbitrary past dates (e.g., backfilling last month's rent).
- **BUSINESS RULE REQUIRES CONFIRMATION:** is backdated manual expense entry an intended capability?

### FIN-07 — No refund/void workflow (also a billing issue, see BILL-06)
Covered fully in §9 (BILL-06) — listed here because it directly affects Finance/revenue correctness: a "corrected" bill can only be hard-deleted, with no retained audit trail, or left permanently in revenue.

---

## 9. Billing → Finance Issues (service/product/membership/cashback separation)

This is the area the brief weighted most heavily. Note there is **already an in-progress, uncommitted fix** in the working tree (`isProductItem()` in `api.js`, wired into `StaffManager.jsx`/`StaffProfile.jsx`) — the findings below establish exactly how far that fix reaches and where the remaining gaps are.

### BILL-01 — `isProductItem()` is applied in only 2 of ~10 places that split revenue by type
- **Severity:** High
- **Covered (uses the new helper):** `StaffManager.jsx:267`, `StaffProfile.jsx:100,174,459`.
- **NOT covered (still uses raw, unguarded `item.item_type === "product"`):**
  - `api.js:1012` — `calculateInvoiceTotals()`, the function that computes the actual saved subtotal/tax/discount for every invoice. **This is the most important gap: it corrupts data at the point of write, not just at display.**
  - `api.js:417-418,425,431` — `saveInvoice()`: decides which items decrement inventory stock.
  - `api.js:824` — `deleteInvoice()` stock-restore.
  - `api.js:1146-1149` — `buildAnalytics()`'s `topServices`, sums **all** items (service+product+membership) with no type filter at all.
  - `Dashboard.jsx:83-89` — revenue-breakdown modal.
  - `ReportsManager.jsx:84-113,943-953` — EOD/monthly reports.
  - `whatsapp.js:206`, `ReviewPage.jsx:229` — lower priority (display-only).
- **Recommended fix:** Move `isProductItem()`-equivalent logic into the single point where invoice line items are classified once (ideally at write time in `saveInvoice`/`calculateInvoiceTotals`, storing a normalized `item_type` rather than re-inferring it on every read), then have every consumer read that normalized field.

### BILL-02 — Membership revenue leaks into `serviceSales`/`servicesCount` (the exact violation the brief calls out)
- **Severity:** Critical — directly contradicts the stated business rule
- **Files:** `StaffProfile.jsx:100-134` (and again at 174-190, 459-479), `StaffManager.jsx:267-283`
- **Root cause:** Even after the recent partial fix, the branch structure is:
  ```js
  if (isProd) { productSales += netVal; }
  else if (item.item_type === "membership") { serviceSales += netVal; servicesCount += qty; }  // <-- bug
  else { serviceSales += netVal; servicesCount += qty; }
  ```
  `isProductItem()` explicitly returns `false` for memberships (by design — it's a product-only heuristic), but there is no equivalent membership exclusion; the membership branch falls straight into `serviceSales`.
- **Concrete example (from the brief's own test case):** Invoice with ₹500 haircut (service) + ₹300 shampoo (product) + ₹1000 membership renewal. Correct service revenue = ₹500. Actual computed `serviceSales` = **₹1500**, and `servicesCount` is incremented as if the membership signup were a service performed — directly inflating the KPI a manager would use to judge service-based incentives.
- **Recommended fix:** Add an explicit `item_type === "membership"` branch that adds to a separate `membershipSales` bucket, mirroring how `productSales` is already isolated. Do **not** fold it into the `else`.
- **Test required:** Mixed invoice (service + product + membership + cashback redemption) → assert `serviceSales` includes only the service line.

### BILL-03 — `ReportsManager.jsx` has no membership bucket at all
- **Severity:** Critical (same root cause as BILL-02, different file)
- **Files:** `ReportsManager.jsx:84-113,943-953` — `serviceBreakdown`/`netServices`/`services` computations have no membership branch whatsoever; any non-`"product"` item falls into the service bucket by default, same bug as BILL-02 but not even partially addressed here.

### BILL-04 — `grossSales` double-counts wallet recharge + wallet redemption invoices (latent)
- **Severity:** Medium (not yet user-visible — confirmed `grossSales` is computed in `buildAnalytics` at `api.js:1099` but not currently rendered anywhere)
- **Root cause:** `revenue`/`todayRevenue`/etc. correctly exclude `payment_method === "Wallet Balance"` invoices, but `grossSales` doesn't apply the same exclusion — so a wallet top-up (counted once as its own invoice) and the later spend of that same money (`payment_method: "Wallet Balance"`) both land in `grossSales`, double-counting the same rupee.
- **Recommended fix:** Apply the same wallet-balance exclusion to `grossSales` before it is ever surfaced in the UI.

### BILL-05 — Wallet recharge invoices are tagged `item_type: "membership"`
- **Severity:** Medium
- **File:** `api.js:636` (`rechargeCustomerWallet`), `service_name: "Wallet Recharge (Value: ₹X)"`, `item_type: "membership"`
- **Impact:** Conflates wallet recharges with real membership purchases in any membership-bucketed report (e.g. `Dashboard.jsx:85-86` `membershipsTotal`), inflating that KPI.
- **Recommended fix:** Give wallet recharges their own `item_type` (e.g. `"wallet"` — already anticipated by `isProductItem()`'s early-return check for `item_type === "wallet"` at `api.js:38`, suggesting this was intended but not finished).

### BILL-06 — No refund/void workflow exists despite schema support
- **Severity:** High
- **Evidence:** `invoices.status` supports `'void'`/`'refunded'` via a CHECK constraint, and every revenue/report aggregation correctly *excludes* `status='void'` — but **nothing in the entire codebase ever sets that status**. The only way to "undo" a bill is `deleteInvoice()` (`api.js:816-864`), a hard delete that removes the row entirely (reversing stock/wallet effects) with **no retained record**.
- **Business impact:** A corrected/cancelled bill either (a) stays counted in revenue forever if left alone, or (b) vanishes with no audit trail if deleted — there is no middle option that satisfies both "not counted" and "traceable."
- **BUSINESS RULE REQUIRES CONFIRMATION:** is full-delete-on-cancel the intended workflow, or should there be a soft-void status with a reason field? Given the schema already anticipates it, soft-void is likely the intended design — but confirm before implementing.

### BILL-07 — Mis-typed custom item in POS persists wrong `item_type` into the invoice
- **Severity:** High
- **File:** `BillingPOS.jsx:349-386` (`handleAddCustomItem`)
- **Root cause:** Custom items resolve to `"product"` only on an **exact** (trimmed/lowercased) name match against inventory; otherwise they use whatever the staff member picked in a required dropdown that defaults to `"service"`. If staff types a product name with a typo or a product not yet in inventory and forgets to flip the dropdown, the item is saved as `item_type: "service"`.
- **Downstream impact:** Because `calculateInvoiceTotals` (BILL-01) uses the raw check, it wrongly applies the service tax-inclusive extraction to a product price (corrupting the invoice's stored subtotal/tax split — not just a display bug), and `saveInvoice` skips stock decrement for what was actually a product sale. `StaffManager`/`StaffProfile` would *partially* self-correct via `isProductItem()`'s keyword fallback, but the persisted invoice data, stock level, and every other report remain permanently wrong.
- **Recommended fix:** Once `isProductItem()`-equivalent classification is centralized (BILL-01's fix), also surface a confirmation warning in the custom-item modal when a typed name partially matches an inventory product name but the dropdown says "service."

### BILL-08 — `makeInvoiceNumber` non-atomic (minor race)
- **Severity:** Low/Medium
- **File:** `api.js:1208-1228` — `SELECT MAX(...)` then `INSERT`, not atomic. A genuine concurrent race would surface as a raw Postgres unique-violation error (a `UNIQUE` constraint on `invoice_number` exists as backstop) rather than a silent duplicate — annoying, not corrupting.

---

## 10. Payroll → Finance Issues

Covered fully in §8 (FIN-01, the non-idempotent `markSalaryPaid`). Everything else about the payroll↔finance link (traceability via `source_id`, correct advance issuance/recovery accounting) is confirmed **working correctly** — see ADV-02 in §6.

---

## 11. Dashboard Issues

See FIN-02 (IST/UTC inconsistency causing headline-vs-drilldown mismatch) and BILL-04/BILL-05 (gross sales double-count, membership bucket pollution). Full KPI source map:

| KPI | Source | Filter | Date logic | Risk |
|---|---|---|---|---|
| Today/Monthly/Weekly Revenue | `invoices` via `buildAnalytics()` | excludes void + Wallet Balance payments | `getISTDate()` (correct) | None |
| Revenue-breakdown modal | `invoices` | excludes void | raw UTC `new Date()` | Mismatches headline (FIN-02) |
| Stock Valuation | `inventory` | `stock_qty × unit_price` | n/a | Disconnected from P&L (FIN-03) |
| P&L Revenue/Expenses | `invoices`/`expenses` | month string match | month string match | Low risk of legacy double-count between `cash_register` and `expenses` (heuristic string match, not FK) |
| Staff "Total Sales" | `invoice_items` | excludes void, uses `isProductItem()` | n/a | Membership still leaks (BILL-02) |

No case was found of a manual "Sales" figure duplicating invoice-derived revenue — billing is confirmed to be the single source of truth for revenue.

---

## 12. Security Issues

This is the highest-priority section of the audit — see §18 Top 10.

### SEC-01 — No authorization model in the application
- **Severity:** Critical
- **Evidence:** `Login.jsx:20-32` — auth is `supabase.auth.signInWithPassword` with an unconditional redirect to `/dashboard`; no role lookup. `AdminApp.jsx:26-57` (`RequireAuth`) checks only for *any* active session. `staff.role` (e.g. "Stylist") is a cosmetic job-title field, never consulted for access control. An `admin_profiles` table with a proper `role` enum (`admin/manager/receptionist/accountant`) exists in the schema but is **never referenced anywhere in `src/`** — dead RBAC infrastructure.
- **Impact:** Every staff member who can log in has byte-for-byte identical access to Finance, payroll, and every other admin page.

### SEC-02 — All financial/HR tables: RLS policy is fully open to any authenticated user
- **Severity:** Critical
- **Evidence (quoted verbatim from `fix-all-rls-policies.sql`, repeated identically in `salon-erp-extension.sql`, `membership-hr-inventory.sql`, `full-database-migration.sql`):**
  ```sql
  CREATE POLICY "staff_admin"          ON public.staff          FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "staff_payments_admin" ON public.staff_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "staff_advances_admin" ON public.staff_advances FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "expenses_admin"       ON public.expenses       FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "invoices_admin"       ON public.invoices       FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "cash_register_admin"  ON public.cash_register  FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "customers_admin"      ON public.customers      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  ```
- **Concrete exploit:** Any staff login (even a junior stylist) can open devtools and issue a direct PostgREST call (e.g. `PATCH .../staff_payments?id=eq.<any-id>`) to view or alter **any other employee's** salary/net-payable, mark arbitrary payroll paid, or delete/forge advances, expenses, or invoices — completely bypassing the UI.
- **Reinforcing evidence this is actually exercised, not just theoretical:** `api.js:107-108` — `fetchAdminData()` does an unfiltered `select("*")` on `staff_payments` and `staff_advances` on every admin page load, so every logged-in browser already downloads every other employee's salary and advance history regardless of which page they're viewing.

### SEC-03 — `wallet_transactions` (cashback ledger) writable by unauthenticated users
- **Severity:** Critical
- **Evidence:** `migrations/20260905000000_customer_wallet_and_loyalty.sql:52-56`:
  ```sql
  CREATE POLICY "Allow all for authenticated/anon on wallet_transactions"
    ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);
  ```
  No `TO` clause → defaults to `PUBLIC`, applying to both `anon` and `authenticated`. `customers.wallet_balance` itself is protected by a separate `TO authenticated`-scoped policy, so an anonymous caller can't directly overwrite a balance — but **can freely forge or delete ledger rows** (fake `cashback_credit`/`recharge_credit` entries with arbitrary amounts), corrupting the audit trail and any report reading this table.
- **Fix:** Add `TO authenticated` at minimum; ideally scope further so a customer/session can only see their own ledger rows if this table is ever exposed to a customer-facing surface.

### SEC-04 — Client-computed financial values trusted with no server-side validation
- **Severity:** High
- **Evidence:** `api.js:1580-1586` — `staff_payments.net_payable`, `incentives`, `advances_deducted`, `other_deductions` are all raw client numbers written straight to the row; no RPC/trigger recomputes `net_payable` server-side. `BillingPOS.jsx:1036-1041` — invoice `discount`/`discountPct` likewise. Wallet balance math (`api.js:563-599,684-851`) computes the new balance in JS and writes it directly, rather than deriving it from the `wallet_transactions` ledger via a trigger.
- **Exploit:** A logged-in user (or, for the ledger, anyone at all given SEC-03) can PATCH `net_payable` or `wallet_balance` to an arbitrary value; nothing in Postgres validates the arithmetic.

### SEC-05 — Housekeeping
- `.env` (public anon key + URL — not secret by design) is committed to git despite `.gitignore` listing it; low severity but worth cleaning up.
- No `service_role` key leak was found anywhere in `src/` — confirmed via exhaustive grep.

---

## 13. Performance Issues

### PERF-01 — `reload()` refetches all ~23 tables on every single mutation
- **Severity:** Medium, growing to High as data volume increases
- **Evidence:** `AdminLayout.jsx:209` — `reload = () => fetchAdminData().then(setAdminData)`; `fetchAdminData` (`api.js:84-156`) pulls `invoices` (limit 2500, joined), `customers` (2000), `transactions` (2500), `wallet_transactions` (3000), `attendance` (1000), etc. Called after **every** save/delete/toggle across `FinanceManager.jsx` (9 call sites), `StaffManager.jsx` (6), `InventoryManager.jsx` (4) — e.g. toggling one "Fixed Expense Paid" checkbox triggers ~23 parallel round trips and a full client-side re-normalize of thousands of rows.
- **Recommended fix:** Scope `reload()` to just the table(s) actually affected by each mutation, or apply an optimistic local-state patch instead of a full refetch.

### PERF-02 — Dead code
- `CashRegisterManager.jsx` (526 lines) is imported but its route redirects to `/finance` — never actually rendered. Safe to delete; currently just maintenance-burden/confusion risk.

No N+1 query patterns were found — all admin pages correctly consume the shared `useAdmin()` context rather than issuing independent queries.

---

## 14. Testing Gaps

No automated test coverage exists for any of the payroll, finance, or billing-classification logic described above (the repo has `vitest`/`playwright` configured per `package.json`, but no tests target these modules — confirmed no relevant spec files under a quick scan of the repo structure). Minimum required test cases before shipping fixes:

**Payroll:** normal salary; salary + incentive; salary + advance (full + partial recovery); salary + LOP once implemented; zero-value components; mid-month joiner (once proration rule confirmed); salary changed while a prior month is still unpaid (PAY-01 regression); duplicate "Mark Paid" click / retry (FIN-01 regression).

**Finance:** manual expense (all categories); automatic salary expense creation + idempotency; salary advance issuance + recovery (no double-count); expense edit/delete; monthly/yearly totals across the IST midnight boundary (FIN-02 regression).

**Billing:** service-only invoice → incentive-eligible; product-only invoice → service incentive NOT generated; membership-only invoice → service incentive NOT generated (BILL-02/03 regression); mixed invoice (service+product+membership+cashback) → correct per-bucket split; wallet recharge invoice → not counted as membership (BILL-05) or double-counted in gross sales (BILL-04); custom item with mismatched dropdown (BILL-07 regression); duplicate bill submission.

**Integration:** payroll regenerated twice for the same period → no duplicate incentive/expense; staff renamed → historical performance data unchanged (SAL-02 regression); staff deleted → confirm actual cascade behavior against live DB before relying on any assumption.

---

## 15. Business Rules Requiring Clarification

These are **not bugs** — they are undefined or ambiguous business rules found while reading the code. No fix should be attempted for these without explicit confirmation:

1. **Partial-month/joining-date proration** (PAY-02) — is salary prorated for mid-month joiners, or flat regardless?
2. **Incentive formula** (PAY-03) — exact percentage/threshold/tiered logic for Product Incentive and Target Incentive; none exists today (currently 100% manual entry).
3. **Overtime** (PAY-04) — is overtime pay a real requirement? If so, rate, threshold, and approval workflow are all undefined.
4. **Food/Travel Allowance** (PAY-05) — eligibility and calculation entirely undefined; no fields exist.
5. **LOP/absent deduction** (PAY-08) — is attendance-based deduction actually intended (strongly implied by the dedicated `days_present` schema migration, but never wired up)? If yes: per-day rate formula, and definition of "working days" (no holiday/weekly-off calendar exists; `leave` status isn't split into approved/unapproved).
6. **Partial advance recovery across multiple months** (ADV-01) — current design can only fully-recover or leave-pending within a single tagged month; no multi-month installment concept exists.
7. **Inventory purchase → expense linkage** (FIN-03) — should every stock addition auto-create an expense, or only ones explicitly flagged as a purchase (vs. internal transfer/correction)?
8. **Backdated manual expense entry** (FIN-06) — is this a required capability, or is same-day/prior-day-only intentional?
9. **Refund/void workflow** (BILL-06) — soft-void with reason tracking, vs. the current hard-delete-only behavior?
10. **Staff hard-delete cascade behavior on payroll/advances** (PAY-12, below) — needs live-DB inspection to even determine current behavior, then a decision on whether hard-delete should be allowed at all for staff with financial history.

---

## 16. P0 / P1 / P2 / P3 Fix Plan

### P0 — data corruption, incorrect financial calculations, duplicate payroll, financial double-counting, security vulnerabilities, permission bypasses
| ID | Fix |
|---|---|
| SEC-02 | Scope RLS policies on `staff`, `staff_payments`, `staff_advances`, `expenses`, `invoices`, `customers`, `cash_register` to require a real role check (needs SEC-01 role model first) |
| SEC-01 | Introduce an actual role/permission model (wire up the existing but unused `admin_profiles.role`) and enforce it both in the UI and in RLS |
| SEC-03 | Add `TO authenticated` to the `wallet_transactions` policy immediately (smallest safe change; further scoping can follow) |
| PAY-01 | Stop overwriting `base_salary` on regeneration of existing (even unpaid) `staff_payments` rows |
| ADV-01 | Add an amount-aware advance-recovery mechanism (schema change: `amount_recovered` or a repayment ledger) |
| FIN-01 | Make `markSalaryPaid` idempotent (status guard + unique constraint on `expenses.source_id`) |
| BILL-02 / BILL-03 | Stop membership items from falling into `serviceSales`/`servicesCount` in `StaffManager.jsx`, `StaffProfile.jsx`, `ReportsManager.jsx` |
| SAL-02 | Add `staff_id` FK to `invoice_items` for attribution (schema change — plan carefully, backfill required) |

### P1 — broken payroll workflows, finance integration issues, billing/finance inconsistencies, incorrect dashboard calculations, major performance problems
| ID | Fix |
|---|---|
| PAY-08 | LOP/absent deduction — **blocked on business-rule confirmation** (§15 item 5) |
| BILL-01 / BILL-07 | Centralize item-type classification into the invoice write path (`saveInvoice`/`calculateInvoiceTotals`), not just display-side |
| BILL-06 | Implement soft-void/refund workflow — **blocked on business-rule confirmation** (§15 item 9) |
| FIN-02 | Standardize all "today"/"month" date logic on the existing `getISTDate()` helper |
| FIN-03 | Auto-expense inventory purchases — **blocked on business-rule confirmation** (§15 item 7) |
| SEC-04 | Move payroll/discount/wallet-balance arithmetic server-side (RPC or trigger) so client values aren't trusted as-is |
| PERF-01 | Scope `reload()` to affected tables instead of refetching all 23 |

### P2 — validation gaps, missing reports, UX reliability, non-critical inconsistencies
| ID | Fix |
|---|---|
| BILL-04 | Exclude wallet-balance invoices from `grossSales` (currently unused in UI — fix before it's surfaced) |
| BILL-05 | Give wallet recharges their own `item_type` instead of `"membership"` |
| FIN-04 | Make manual-expense `payment_method` selectable instead of hardcoded "Cash" |
| FIN-05 | Capture `created_by` on manual expenses |
| FIN-06 | Backdated expense entry — **blocked on business-rule confirmation** (§15 item 8) |
| PAY-12 | Add a confirmation warning (and ideally a block) on staff hard-delete when payroll/advance/attendance history exists — needs live-DB cascade verification first |
| PAY-10 | Verify/add a DB-level unique constraint on `staff_payments(staff_id, work_month)` |

### P3 — code quality, refactoring, minor UI improvements
| ID | Fix |
|---|---|
| PERF-02 | Delete unused `CashRegisterManager.jsx` (confirm truly unrouted first) |
| SEC-05 | Remove `.env` from git tracking (rotate if ever made non-public, though anon key is public-by-design) |
| PAY-13 | Commit the actual live schema for `staff_payments`/`staff_advances`/`base_salary` into `supabase/` so source control matches production |
| ADV-02 | Add a UI note clarifying that "Staff Advance" expense entries remain visible after recovery by design (net salary already accounts for it) |

---

## 17. Files / Functions Affected (index)

- `src/lib/api.js` — `isProductItem` (35-61), `calculateInvoiceTotals` (~1012), `saveInvoice` (~380-440), `deleteInvoice` (816-864), `buildAnalytics` (1094-1173), `makeInvoiceNumber` (1208-1228), `saveStaffPayment` (1572-1604), `markSalaryPaid` (1606-1632), `saveStaffAdvance` (1635-1661), `deleteStaffAdvance` (1663-1669), `saveExpense` (1672-1695), `deleteExpense` (1697-1700), `rechargeCustomerWallet` (604-631), `awardBillCashback` (684-725), `redeemWalletBalance` (727-762), `fetchAdminData` (84-156), `getISTDate` (18-22)
- `src/pages/admin/StaffManager.jsx` — Performance tab (206-308), `handleGenerateWorksheet` (333-401), `handleSaveDraftRow` (55-131), `handleMarkPaid` (413-434), `handleDeleteStaff` (192-201)
- `src/pages/admin/StaffProfile.jsx` — sales/incentive computations (49-210, 450-479)
- `src/pages/admin/BillingPOS.jsx` — `handleAddCustomItem` (349-386), bill save flow
- `src/pages/admin/FinanceManager.jsx` — `handleAddRegisterExpense` (158-216), `isTodayOrYesterday` (44-61), P&L computation (484-553)
- `src/pages/admin/Dashboard.jsx` — `getRevenueBreakdown` (53-103)
- `src/pages/admin/AnalyticsDashboard.jsx` — EOD report data (13-26)
- `src/pages/admin/ReportsManager.jsx` — report aggregation (21-113, 943-953)
- `src/pages/admin/InventoryManager.jsx` — `adjustStock` (120-129)
- `src/pages/admin/Login.jsx`, `src/AdminApp.jsx` — auth/role gating
- `supabase/fix-all-rls-policies.sql`, `supabase/salon-erp-extension.sql`, `supabase/membership-hr-inventory.sql`, `supabase/full-database-migration.sql`, `supabase/migrations/20260905000000_customer_wallet_and_loyalty.sql` — RLS policies

---

## 18. Top 10 Production Risks

1. **[SEC-02/SEC-04] No real authorization anywhere** — every logged-in staff account can read/write every other employee's salary, all expenses, all customer data, and all invoices via direct API calls, completely bypassing the UI.
2. **[SEC-03] Unauthenticated users can write to the cashback ledger** — `wallet_transactions` RLS policy has no `TO` clause, defaulting to `PUBLIC`.
3. **[PAY-08] LOP/absent-day deduction is not implemented** — staff are paid in full regardless of absences; the field to support it exists but is never used in salary math. This is an ongoing, silent overpayment every pay cycle.
4. **[PAY-01] Historical unpaid payroll can be silently corrupted** — regenerating a worksheet for a past unpaid month overwrites it with the staff's *current* salary.
5. **[ADV-01] Salary advance ledger can permanently desync from reality** — recovery is a binary flag, not an amount-aware balance; a manual partial-recovery edit produces an undetectable accounting discrepancy.
6. **[FIN-01] Salary expenses can be silently double-booked** — `markSalaryPaid`'s Finance-expense creation isn't idempotent; a retry after a partial failure doubles the "Salaries" line with no error shown.
7. **[BILL-02/BILL-03] Membership revenue counts as service revenue** — the exact rule the brief called out as critical is currently violated in the two staff-performance pages and the reports module, inflating the numbers used to judge service-based incentives.
8. **[SAL-02] Renaming an employee silently erases their historical performance data** — revenue/tip attribution is keyed on a free-text name string, not a stable ID.
9. **[PAY-12] Staff hard-delete has no safeguard** — a single confirm dialog permanently deletes a staff record and cascades to delete all their attendance history, with the payroll/advance cascade behavior unverifiable from the committed schema.
10. **[FIN-03/BILL-07] Two related data-integrity gaps in the money-in/money-out chain** — inventory purchase costs never reach Finance (permanently understating true expenses), and a mistyped custom POS item can corrupt an invoice's stored subtotal/tax and silently skip stock decrement.
