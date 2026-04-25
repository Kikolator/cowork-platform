# @cowork/db

Supabase database package — migrations, edge functions, and generated TypeScript types.

## Adding a migration

```bash
# 1. Create the migration file (from packages/db/)
supabase migration new <name>

# 2. Write your SQL in the generated file

# 3. Apply locally and regenerate types
supabase db reset              # replays all migrations + seed
npm run db:types               # generates types/database.ts from local DB

# 4. Commit both together
git add supabase/migrations/ types/database.ts
git commit -m "db: <description>"
```

`types/database.ts` is generated-but-committed. CI verifies it's in sync — if you forget to regenerate, the `verify-db-types` job will fail with a clear error.

## Scripts

| Command | Description |
|---|---|
| `npm run db:types` | Regenerate `types/database.ts` from local Supabase |
| `npm test` | Run Vitest tests |

## Prerequisites

- Docker running (for `supabase start`)
- Supabase CLI installed (`npx supabase`)
