---
name: commit-push-pr
description: Commits staged changes, pushes to remote, and creates a GitHub PR with a structured description. Runs in the main conversation context.
disable-model-invocation: true
argument-hint: "[commit message or description]"
allowed-tools: Bash, Read, Glob, Grep
---

# Commit, Push & Create PR

When the user invokes this skill, perform the following steps.
If arguments were provided, use them as guidance for the commit message: $ARGUMENTS

## Step 1: Assess Changes

Run these commands to understand the current state:
- `git status` — see staged/unstaged changes
- `git diff --cached` — review what will be committed
- `git log --oneline -5` — check recent commit style
- `git branch --show-current` — check current branch

If nothing is staged, ask the user what to stage or suggest staging all modified files (excluding secrets/env files).

## Step 2: Ensure Feature Branch

1. Check the current branch name.
2. If on `main` or `dev`, **do not commit**. Instead:
   - Determine the commit type from the staged changes: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `style`, `perf`, `ci`, `build`
   - Derive a short description from the changes (2-4 words, kebab-case)
   - Create and switch to a new branch: `git checkout -b <type>/<short-description>`
   - Example: `feat/add-auth-middleware`, `fix/stripe-webhook-retry`, `docs/update-readme`
3. If already on a feature branch, continue.

## Step 3: Commit

1. Analyze the staged diff to understand the nature of the changes.
2. Draft a commit message using conventional commit format: `<type>: <description>`
3. The type in the commit message should match the branch prefix.
4. Create the commit.

## Step 4: Push

1. Check if the current branch tracks a remote: `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}`
2. If no upstream, push with `-u`: `git push -u origin <branch>`
3. If upstream exists, push: `git push`

## Step 5: Create PR

1. Check if a PR already exists: `gh pr view --json number 2>/dev/null`
2. If no PR exists, create one:
   - Title: concise summary under 70 characters
   - Body: structured with Summary, Test Plan, and any relevant context
   - Base branch: `dev` (always use `gh pr create --base dev`)
3. If a PR exists, inform the user and show the PR URL.

## Guards

- **Never commit directly to `main` or `dev`** — always create a feature branch first
- Never force push
- Never commit files matching: `.env*`, `*.pem`, `*credentials*`, `*secret*`
- Always show the commit message and PR body for user approval before executing
- PR base is always `dev`. Never target `main` unless the user explicitly asks (e.g., "create a release PR", "merge dev into main")
- `dev→main` PRs are release PRs — only create them when explicitly requested

## TODO
- [ ] Add support for draft PRs (--draft flag)
- [ ] Add auto-labeling based on changed file paths
- [ ] Add reviewer assignment from CODEOWNERS
- [ ] Add linked issue detection from branch name
