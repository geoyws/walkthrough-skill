# walkthrough-skill

A portable agent skill that generates and refreshes a **codebase walkthrough**:
a small static site (VitePress) that tells a newcomer what a repository is,
how it is laid out, where the interesting code lives, and what changed since
the walkthrough was last refreshed. Every page carries the commit it was
generated from, so a stale walkthrough says so instead of lying quietly.

Written for teams where agents ship faster than humans can read. The generated
layer is regenerated from the tree on every refresh; the authored layer is a
thin narrative that the refresh diffs against the tree and flags when it
drifts.

## Install

The skill is a plain `SKILL.md` plus scripts. Symlink the repository into
whatever directory your harness reads skills from:

```bash
git clone https://github.com/geoyws/walkthrough-skill.git
ln -s "$PWD/walkthrough-skill" ~/.agents/skills/walkthrough
```

Works unchanged with Claude Code, Codex, Kimi Code, omp and any harness that
reads `SKILL.md` files. Harness-specific metadata, if any, is additive.

## Use

Read [`SKILL.md`](SKILL.md). The short form:

```text
/walkthrough init      # scaffold docs/walkthrough/ in the current repository
/walkthrough refresh   # regenerate inventory, topology, diff-since-last; stamp the commit
/walkthrough check     # exit non-zero when the stamp is behind HEAD or any submodule
```

## Publishing a change to this repository

This is a public repository. `scripts/check-public.sh` refuses text that
belongs to a private estate (internal hostnames, machine or tier sigils, IP
addresses, non-public e-mail addresses). Run it before every push.

## License

MIT. See [LICENSE](LICENSE).
