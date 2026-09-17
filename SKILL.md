---
name: walkthrough
description: Generate, refresh, check and publish a commit-stamped codebase walkthrough — a small VitePress site under docs/walkthrough/ that tells a newcomer what a repository is, where its code lives, how each area runs, and what changed since the walkthrough was last refreshed. Use when the user invokes '/walkthrough init|refresh|check|publish', asks for a "codebase walkthrough", an onboarding or orientation doc for a repo, says "help me understand this repo before diving in", wants a monorepo map with submodule pins, or wants to know whether an existing walkthrough is stale.
---

# Walkthrough

## Purpose

A newcomer should grasp a repository in about twenty minutes before reading
code. A hand-written onboarding document fails at that within weeks: it rots
silently and nobody can tell which parts are still true.

This skill produces a site with two layers and a commit stamp:

- **generated** — regenerated from the tree on every refresh. Inventory,
  submodule topology at every depth, scripts, ADR index, what changed since the
  previous refresh, and drift (authored pages citing paths that no longer
  exist). Never hand-edited.
- **authored** — a thin narrative an agent or a human writes: what the repo is,
  the reading order, the traps, the glossary, one page per area. Small enough to
  review, because everything mechanical lives in the generated layer.

Every page footer carries the commit the site was generated from, so a stale
walkthrough says so instead of lying quietly.

## Command contract

The generator is `scripts/walkthrough.mjs` in this skill directory. Node ≥ 20,
zero dependencies. VitePress is the only devDependency it adds to the target
repository.

```bash
node scripts/walkthrough.mjs <command> [--repo DIR] [--base PATH]
```

| Command | Does |
| --- | --- |
| `init` | Creates `docs/walkthrough/` if absent, never overwriting an authored file. Writes `walkthrough.config.json`, `.vitepress/config.mts`, the stamp-footer theme, authored skeletons, vendors itself to `docs/walkthrough/bin/walkthrough.mjs`, adds the five `walkthrough:*` scripts plus the `vitepress` devDependency entry (no install), then runs `refresh`. |
| `refresh` | Regenerates `generated/*` and `manifest.json`, and recomputes the sidebar only between the `// walkthrough:sidebar:begin` / `:end` markers. Prints a summary and the drift list. Exits 0 even with drift; drift is informational. |
| `check` | Compares the stamped root sha against `HEAD` and every stamped submodule sha against `git submodule status --recursive`. Prints `STALE <path> <stamped> -> <live>` per mismatch and exits 1, else prints `FRESH <short>` and exits 0. Never touches the network. |
| `publish` | Not a generator subcommand — a two-step procedure: `build`, then copy the built directory to wherever the docs host ingests it. See below. |

Supporting commands: `build` (vitepress build, base from `--base` >
`WALKTHROUGH_BASE` > `config.base`; runs `check` first and prints the result but
does not fail on stale), `dev` and `serve` (vitepress dev / preview on
localhost:5180 / 5181). All three resolve `node_modules/.bin/vitepress` in the
target repo root and fail with a one-line install hint if it is missing.

After `init`, colleagues need no skill installed: the vendored
`docs/walkthrough/bin/walkthrough.mjs` and the `walkthrough:*` package scripts
are enough.

## Authoring procedure (the agent's job)

`init` leaves six-section skeletons behind. Filling them is the work.

1. **Read the tree first.** Root config and manifest files, `AGENTS.md` or
   equivalent, the ADR directory, then each configured area's entry points and
   its `package.json` scripts. Read `generated/inventory.md`,
   `generated/submodules.md` and `generated/scripts.md` — they are already the
   mechanical answer, so the narrative should not repeat them.
2. **Write the authored pages**, each with these six sections in order:
   1. *What it is* — 2–5 plain sentences for a newcomer.
   2. *Where things live* — a table: path → what is there → read it when.
   3. *How it runs* — dev, test, build, deploy commands that actually exist in
      that area, cited by exact script name.
   4. *Boundaries and invariants* — what must stay true, citing the ADR number
      or the `AGENTS.md` section that says so.
   5. *Start here* — 3–7 files in reading order, one clause each on why.
   6. *Open questions / known rough edges* — only what the tree evidences:
      TODO files, handoff notes, ADR status lines, failing-gate notes. No
      speculation.
3. **Cite paths as inline code**, repo-relative. Never invent a path.
4. **Run `refresh`.** Then read `generated/drift.md` and fix every listed
   citation — a miss means the narrative is describing a tree that does not
   exist.
5. **Run `check`.** Commit the site only from a `FRESH` state, so the stamp
   matches what the reader is looking at.

Length discipline: index one screen, area pages 80–200 lines, guide pages
40–120 lines. If a page grows past that, the content probably belongs in the
generated layer or in code comments.

## Refresh procedure

1. Run `refresh`.
2. Read `generated/changes.md`. It lists, per configured area, the commits
   between the previously stamped root commit and `HEAD`, plus submodule pin
   moves with their own logs, plus ADR files added or removed.
3. Update **only** the authored pages whose areas actually changed. An area with
   zero commits needs no edit.
4. Read `generated/drift.md` again and fix broken citations.
5. Never edit anything under `generated/`; the next refresh overwrites it.

## Publish

Publishing is repo- and host-specific on purpose; the skill does not guess.

1. Build with the base path the host will serve the site under:
   `node scripts/walkthrough.mjs build --base /walkthrough/` (or set
   `WALKTHROUGH_BASE`, or put it in `walkthrough.config.json`). A wrong `base`
   is the usual cause of a site that loads HTML but no assets.
2. Copy `docs/walkthrough/.vitepress/dist` to wherever the docs host ingests
   static output — a docs-site content directory, an object-storage prefix, a
   static tier's document root. The harness, repository conventions or the
   operator decides where; this skill does not.
3. Verify the **served** site, not the local build: fetch `<base>manifest.json`
   (`build` copies the stamp into the dist root) and compare `root.sha` with the
   commit you built from; then open a page and confirm the footer agrees. If
   either shows an older SHA, the copy step or a cache — not the generator — is
   wrong.

## Staleness rules

- The stamp lives in `docs/walkthrough/manifest.json`: root sha, short sha,
  branch, dirty flag, refresh time in UTC and local time, and every submodule
  pin with its depth.
- The commit that records a refresh necessarily moves `HEAD` past the stamp.
  `check` therefore treats `HEAD` as fresh when every difference between the
  stamped commit and `HEAD` lies under `docs/walkthrough/`, and says so:
  `FRESH <stamped> (HEAD <short> differs only under docs/walkthrough)`. For
  the same reason `dirty` ignores uncommitted changes under `docs/walkthrough/`
  — the walkthrough is not the code it describes.
- `check` is the gate. Wire `walkthrough:check` into CI or a pre-publish step
  when a repository cares that its walkthrough tracks `HEAD`.
- A stale site is still useful and still builds; the footer is what makes it
  honest. Never hand-patch `manifest.json` to silence `check` — refresh instead.
- `dirty: true` means the stamped tree had uncommitted changes, so the site
  describes something nobody else can check out. Prefer refreshing from a clean
  tree.
- `previous` in the manifest is what makes `generated/changes.md` possible: it
  is read from the manifest on disk before the overwrite. Do not delete the
  manifest to "start clean" unless you want to lose the baseline.

## Privacy rules

The walkthrough is often published wider than the code it describes. Treat it as
public unless told otherwise.

- No secrets, tokens, keys, connection strings or staff logins — not even
  expired ones.
- No private hostnames, internal IP addresses or internal URLs. Tier and
  product names that the repository already publishes in its own `AGENTS.md`
  are fine; anything that only appears in private notes is not.
- Cite code by repo-relative path, never by absolute path from someone's
  machine.
- If this skill repository itself is public, run its own gate:
  `bash scripts/check-public.sh`. Extend it per repository via
  `.check-public-patterns`.

## Portability

This is a plain `SKILL.md` plus a dependency-free Node script. Any harness that
reads skill files can use it; nothing here is specific to one agent runtime. The
generator is also a normal CLI, so a human can run it directly, and the vendored
copy inside a target repository keeps working after the skill is uninstalled.

Templates are inlined in `scripts/walkthrough.mjs` as string constants so that
the vendored copy is a single self-contained file. `templates/` holds readable
copies of exactly those constants, and `scripts/walkthrough.test.mjs` fails if
the two ever diverge.
