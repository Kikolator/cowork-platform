---
name: e2e
description: Runs Playwright E2E tests with smart defaults. Supports running all tests, specific files, or tests matching a grep pattern.
argument-hint: "[file or pattern]"
allowed-tools: Bash, Read, Glob, Grep
---

# E2E Test Runner

Run Playwright end-to-end tests. Target: $ARGUMENTS

## Usage

- `/e2e` — Run all E2E tests
- `/e2e <file>` — Run tests in a specific file
- `/e2e <pattern>` — Run tests matching a grep pattern

## Steps

1. **Verify Playwright is installed:**
   ```bash
   npx playwright --version
   ```
   If not installed, suggest: `npm i -D @playwright/test && npx playwright install`

2. **Determine what to run:**
   - No args: `npx playwright test`
   - File path: `npx playwright test <file>`
   - Pattern: `npx playwright test --grep "<pattern>"`

3. **Run with CI-friendly settings:**
   ```bash
   npx playwright test [args] --reporter=list
   ```

4. **On failure:**
   - Show the failing test output
   - Read the relevant test file and source code
   - Suggest a fix or ask the user how to proceed
   - Offer to open the HTML report: `npx playwright show-report`

5. **On success:**
   - Report pass count and duration
   - Note any skipped tests

## TODO
- [ ] Add support for --ui mode in non-CI environments
- [ ] Add support for running specific browser targets
- [ ] Add trace viewer integration for debugging failures
