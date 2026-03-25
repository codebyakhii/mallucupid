# MalluCupid Development Rules

**These rules must be read and followed before every task.**

---

## Rule 1: Production-Level Code Only
- Always create and implement production-level code.
- Every feature must be built as if it is going live immediately.
- No shortcuts, no placeholders, no "we'll fix it later" patterns.

## Rule 2: No Mock / No Hardcoding
- No mock data, no hardcoded values anywhere in the codebase.
- All data must come from the database (Supabase) or user input.
- All API calls must be real and functional.

## Rule 3: No Assuming / No Guessing
- Never assume data structures or behavior.
- Always verify against existing code and database schema before writing.
- All information must be based on actual code, actual database tables, and actual types.

## Rule 4: No Half Implementations
- Once a step is implemented, both UI and backend must be fully active and working.
- Never leave a feature partially done — complete the full cycle (UI + logic + database + navigation).
- Every implemented step must be testable end-to-end immediately.

## Rule 5: Loading States on All Navigations
- Every navigation between views must use a loading state transition.
- Every button that triggers an async operation must show a loading spinner.
- No instant jumps — always provide visual feedback during transitions.

## Rule 6: Professional Text Formatting
- First letter capital, rest lowercase for all UI text (title case for names).
- Use professional font styles and sizes throughout.
- No unprofessional attitudes, no casual language, no emoji overuse in UI.
- Consistent typography: headings, labels, body text must follow a hierarchy.

## Rule 7: Fix Errors Step by Step
- If any error is found during implementation, add it to the todo list immediately.
- Fix each error one at a time, verifying the fix before moving on.
- Never ignore or skip errors.

## Rule 8: Build Check After Every Task
- Run build check (`npx vite build`) after every task.
- Verify nothing fails after every change.
- Commit and push after every successful task completion.

## Rule 9: Verify Database Migrations
- Verify all database tables and columns are migrated and match the code.
- After any schema change, confirm the migration ran successfully on the live database.
- Keep `supabase/migration.sql` updated with any new schema changes.

## Rule 10: 100% Production Ready
- The app must be 100% production ready at all times.
- Every commit must result in a deployable, working application.
- No broken features in any deployed version.

## Rule 11: Maintain Workflow Documentation
- Keep `WORKFLOW.md` updated after every task.
- Document the full app working flow from authentication to the last feature.
- This file serves as the single source of truth for app behavior.

---

**Read this file and WORKFLOW.md before starting any task.**
