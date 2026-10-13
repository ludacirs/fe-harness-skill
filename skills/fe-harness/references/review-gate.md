# Review Gate (G4)

Two reviewers read one checkpoint's diff from different angles. Neither sees the other's findings.

## Inputs (same for both)

- The CP diff: `git diff <last CP commit or branch base>` plus untracked files of this CP
- The spec items and the CP row from the checkpoint plan
- The RED and GREEN evidence blocks, and VT verdict blocks if the CP has VT items

## Reviewer A — spec fidelity

```
You review one checkpoint of a frontend change against its spec. You did not write it.

Checkpoint: <CP row: goal, classification, test items, VT items, state fixtures>
Spec items in scope: <IT-n / VT-n text>
Evidence: <RED and GREEN blocks>
Diff: <diff>

Report only these problems:
1. A spec item or state in scope is not implemented (loading, empty, error, disabled).
2. The implementation passes the tests without doing the behavior: hardcoded values that
   match test data, branches that only run under test, conditions keyed to fixture contents.
3. Interactive elements without an accessible name or role the tests rely on.
4. A test that cannot fail for the behavior it names.

Output: one line per finding, then nothing else.
A-<n> <file>:<line> — <problem> — <spec item or evidence it contradicts>
No findings → "A: none".
```

## Reviewer B — maintainability

```
You review one checkpoint of a frontend change against this repository's conventions.
You did not write it.

Checkpoint: <CP row>
Diff: <diff>

Search the repository before reporting. Report only these problems:
1. An existing component, hook, or util already does this (name its path).
2. Abstraction with one caller, or configuration nobody varies.
3. Selectors that depend on CSS classes, DOM position, or text likely to change.
4. Comments that restate the code.
5. Divergence from how neighbouring files do the same thing (name the file).

Output: one line per finding, then nothing else.
B-<n> <file>:<line> — <problem> — <path or file that shows the convention>
No findings → "B: none".
```

## Running them

| Condition | How |
|-----------|-----|
| A subagent tool is available | Two subagents in parallel, one prompt each |
| No subagent tool | Run A, then B, yourself from the prompts above. Mark `reviewers: inline` in G5 |

## Closing findings

Every finding closes as one of:

```
A-1 fixed — <what changed>
B-2 rejected — <reason that cites the spec, the CP plan, or a repository file>
```

A rejection reason that cites nothing ("seems fine", "not important") is invalid; fix the finding instead.
"Belongs to CP-n" is valid when the plan assigns it to that later CP.

After any `fixed` → G2 again (GREEN evidence, and G3 if the CP has VT items), then a new review round.
Open findings after round 2 → STOP and hand the CP to the user with the findings.
