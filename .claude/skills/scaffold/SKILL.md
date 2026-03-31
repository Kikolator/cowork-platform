---
name: scaffold
description: Generates boilerplate for common patterns by reading existing project code as the template. Supports api-route, server-action, component, page, supabase-table, and webhook scaffolds.
argument-hint: "<pattern> <name> [options]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Scaffold

Generate boilerplate by discovering conventions from the existing project. The project is the template.

Arguments: $ARGUMENTS

## Usage

- `/scaffold api-route users` — API route handler + types + test
- `/scaffold server-action createPost` — Server action + types + test
- `/scaffold component UserCard` — React component + test
- `/scaffold page dashboard/settings` — Page route with layout, page, loading, error
- `/scaffold supabase-table notifications` — Migration SQL + RLS policies + type generation
- `/scaffold webhook stripe` — Webhook handler with signature verification + test

## Process

### 1. Parse arguments

Extract the pattern and name from `$ARGUMENTS`:
- First word = pattern (`api-route`, `server-action`, `component`, `page`, `supabase-table`, `webhook`)
- Remaining words = name (converted to appropriate casing for the pattern)

If no arguments provided, ask the user what to scaffold.

### 2. Discover project conventions

Before generating anything, read the project to learn its patterns:

**Always read:**
- `CLAUDE.md` — project rules, conventions, import patterns
- `package.json` — dependencies, scripts, project name
- `tsconfig.json` — path aliases, strict mode settings

**Per-pattern discovery:**

#### api-route
- Glob `**/app/api/**/route.ts` — find existing API routes
- Read 1–2 examples to learn: import style, error handling, response format, auth patterns, Zod usage
- Check if there's a shared API utils file (response helpers, auth wrappers)
- Look for existing test files alongside routes

#### server-action
- Grep `'use server'` across the project
- Read 1–2 examples to learn: file location, naming, return types, error handling, revalidation
- Check for Zod validation patterns on action inputs

#### component
- Glob `**/components/**/*.tsx` — find existing components
- Read 1–2 examples to learn: props pattern (inline vs separate type), file structure, test colocation
- Check for `cn()` utility usage, shadcn/ui patterns

#### page
- Glob `**/app/**/page.tsx` — find existing pages
- Read 1–2 examples to learn: metadata exports, data fetching, layout usage, loading/error boundaries
- Check if `loading.tsx` and `error.tsx` are commonly used

#### supabase-table
- Glob `**/migrations/*.sql` — find existing migrations
- Read the most recent 1–2 to learn: naming convention, RLS patterns, index patterns, timestamp columns
- Check for generated types file location

#### webhook
- Grep `webhook` across the project for existing handlers
- Read examples to learn: signature verification, event type switching, error handling
- Check for Stripe-specific patterns if relevant

### 3. Generate files

Create files following the discovered conventions. Use the exact same patterns — imports, naming, error handling, directory structure.

**Naming conventions (derive from project, fall back to these defaults):**
- API routes: `kebab-case` directories (`app/api/user-profiles/route.ts`)
- Server actions: `camelCase` functions in `actions/` or colocated
- Components: `PascalCase` files in `components/`
- Pages: `kebab-case` directories in `app/`
- Migrations: `<timestamp>_<description>.sql`
- Webhooks: `app/api/webhooks/<service>/route.ts`

**For each pattern, generate:**

#### api-route `<name>`
1. `app/api/<name>/route.ts` — GET/POST handlers with proper types, auth, validation
2. `app/api/<name>/route.test.ts` — test file (or wherever project puts API tests)

#### server-action `<name>`
1. `actions/<name>.ts` (or project convention) — action with `'use server'`, Zod input, typed return
2. `actions/<name>.test.ts` — test file

#### component `<Name>`
1. `components/<name>.tsx` — component with typed props, proper imports
2. `components/<name>.test.tsx` — test file with render + basic assertions

#### page `<path>`
1. `app/<path>/page.tsx` — page component with metadata
2. `app/<path>/loading.tsx` — loading skeleton (if project uses them)
3. `app/<path>/error.tsx` — error boundary (if project uses them)

#### supabase-table `<name>`
1. `supabase/migrations/<timestamp>_create_<name>.sql` — CREATE TABLE + RLS + indexes
2. Remind user to run `supabase db push` and `supabase gen types typescript`

#### webhook `<service>`
1. `app/api/webhooks/<service>/route.ts` — POST handler with signature verification, event switch
2. `app/api/webhooks/<service>/route.test.ts` — test file

### 4. Show summary

After generating, list:
- Files created (with paths)
- Conventions discovered and applied
- Next steps (e.g., "fill in the handler logic", "run `supabase gen types`", "add your component props")

## Guards

- Never overwrite existing files — if a file exists, warn and skip
- Never generate secrets or API keys — use environment variable references
- Always match the project's existing import style (path aliases, extensions)
- If no existing examples are found for a pattern, use sensible defaults and tell the user
