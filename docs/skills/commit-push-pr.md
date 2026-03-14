---
name: commit-push-pr
description: Commit changes, push to remote, and create a pull request. Use for completing features or fixes ready for review.
disable-model-invocation: true
---

# Commit, Push, and Create PR

Automate the git workflow for completing a feature or fix.

## Pre-computed Context

Before proceeding, gather this information:
- Current branch: `!git branch --show-current`
- Git status: `!git status --short`
- Recent commits on this branch: `!git log --oneline -5`
- Diff summary: `!git diff --stat`

## Workflow

1. **Review Changes**
   - Check `git status` for all modified/added files
   - Ensure no sensitive files are staged (`.env`, `.env.local`, Supabase keys, etc.)
   - Confirm no hand-edited `lib/supabase/types.ts` changes (generated file — should only change via `supabase gen types`)

2. **Run Pre-commit Checks** (in order — stop and fix on any failure)
   - `npm run check-types` — zero TypeScript errors
   - `npm run lint` — zero ESLint warnings
   - `npm run build` — must build clean

3. **Stage and Commit**
   - Stage relevant files: `git add <files>`
   - Commit using Conventional Commits format:
     - `feat:` new feature
     - `fix:` bug fix
     - `refactor:` refactoring
     - `docs:` documentation
     - `test:` tests
     - `chore:` maintenance
     - `db:` migration or schema change
   - Commit message should focus on *why*, not *what*

4. **Push to Remote**
   - Push branch: `git push -u origin HEAD`

5. **Create Pull Request**
   - Use GitHub CLI: `gh pr create`
   - PR must include:
     - Clear title (mirrors commit message format)
     - Description: what changed, why, and any migration steps needed
     - Note any new tables/RLS policies added
     - Reference related issues if applicable

## Arguments

Pass a commit message or leave empty for auto-generated message based on changes.

Usage: `/commit-push-pr [optional commit message]`

Example: `/commit-push-pr feat: add appointment cancellation flow`

## Output

Return the PR URL when complete.
