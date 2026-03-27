---
name: wrap-up
description: "Save session context as a handoff file for the next Claude session. Trigger whenever the user says 'wrap up', 'save session', 'end session', 'save context', 'let's stop here', 'save our progress', 'I'll continue later', 'save this for next time', or anything indicating they want to pause work and resume later. Produces a WRAP_UP.md in the project root that captures state, decisions, pending work, and a ready-to-paste Claude Code prompt to resume. Use this skill even for partial requests like 'can you save where we are' or 'write up a summary of what we did'."
---

# Wrap-Up Skill

Generates a `WRAP_UP.md` session handoff file so the next Claude session can resume with full context — no re-explanation needed.

## Output Location

```
<project-root>/WRAP_UP.md
```

If a project root can't be determined from context, default to the current working directory.

## Git Strategy

**Recommended: gitignore it.**

`WRAP_UP.md` is a developer scratchpad — ephemeral, session-specific, and frequently overwritten. It doesn't belong in version history.

Add to `.gitignore`:
```
WRAP_UP.md
```

However, if the user is working on a shared team project and wants teammates to be able to resume the session, committing it may make sense. Ask if ambiguous — default to gitignore.

## Workflow

1. **Gather context** — review the current conversation: what was worked on, what decisions were made, what's pending, what files were touched, what Claude Code prompts were used or generated
2. **Ask for additions** — prompt the user: "Anything else to capture before I write the wrap-up?" (skip if they seem in a hurry)
3. **Write `WRAP_UP.md`** — use the template below
4. **Confirm gitignore** — check if `.gitignore` already has `WRAP_UP.md`; if not, offer to add it
5. **Present the file** — output path + quick summary of what was captured

## WRAP_UP.md Template

```markdown
# Session Wrap-Up

> Generated: {ISO timestamp}  
> Session focus: {one-line summary}

---

## What We Did

{Bullet list of completed work this session. Be specific — file names, migration names, features shipped.}

## Current State

{Honest snapshot of where the codebase/feature stands right now. What works, what's broken, what's partial.}

## Key Decisions Made

{Decisions with reasoning. Architecture choices, tradeoffs accepted, things explicitly ruled out and why.}

## Known Issues / Blockers

{Active bugs, unresolved errors, things that are broken or need investigation.}

## Up Next

{Prioritized list of the next things to do, in order. Be specific — not "finish auth" but "fix the code_verifier cookie bug in /auth/callback".}

## Files Touched This Session

{List of files that were created or meaningfully modified.}

## Context for Next Session

{Anything Claude needs to know to hit the ground running: env quirks, gotchas discovered, important URLs, relevant docs.}

## Resume Prompt

{A ready-to-paste Claude Code prompt that restores context and kicks off the next session. Should include: project summary, current state, and the first task to tackle. See format below.}
```

---

## Resume Prompt Format

The resume prompt is the most important section. It should be self-contained — paste it into a fresh Claude Code session and work can start immediately.

```
You are helping me continue work on [project name].

**Project:** [1-2 sentence description]
**Stack:** [key stack items]
**Repo:** [path or remote]

**Last session we:**
- [bullet list of completed work]

**Current state:**
[honest snapshot — what works, what doesn't]

**Key context:**
- [gotchas, env quirks, important decisions]
- [anything that would take time to re-discover]

**Today's task:**
[The first concrete thing to work on. Be specific.]

Start by reading CLAUDE.md, then [specific first action].
```

---

## Quality Checks

Before writing the file, verify:
- [ ] The "Current State" is honest — doesn't overstate what's working
- [ ] "Up Next" items are concrete and ordered by priority
- [ ] The Resume Prompt is genuinely self-contained (no "as we discussed" references)
- [ ] File paths are accurate
- [ ] Decisions include reasoning, not just outcomes

---

## Enhancements to Offer

After writing the file, briefly mention these optional add-ons if relevant:

- **Tag it**: `git tag session/YYYY-MM-DD` to mark the codebase state at wrap-up time
- **Stash dirty work**: `git stash push -m "session/YYYY-MM-DD wip"` if there are uncommitted changes
- **Diff summary**: offer to generate a `git diff --stat` summary of what changed this session
- **Open issue**: offer to create a GitHub issue for any blocker identified
