<!--
Lead with the change and its reason in one or two sentences a newcomer can follow, and link the
issue it resolves. Size the rest to the change: a small change needs only the lead and the table.
Cues: ✅ done, ⏳ pending, ⚠️ needs attention, ❌ failed, first in their cell. For a change users
see, add before-and-after screenshots side by side in a table. Draw what branches, loops
or crosses between parts as a Mermaid diagram. Alert only what the reviewer must act on, in one
alert, at most two, never adjacent: `> [!IMPORTANT]` for a decision they own, `> [!WARNING]` for
a breaking change they must prepare for. Delete these comments and unused sections.
-->

<!-- The change, and why. Resolves #… -->

| Fact             | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Feedback wanted  | <!-- what to judge -->                                                    |
| `bun run check`  | ⏳ <!-- link the Check job's run, whose summary holds Vitest's report --> |
| Smoke tests      | ⏳ <!-- link the smoke-test-report artifact -->                           |
| Mutation testing | ⏳ <!-- link the mutation-report artifact -->                             |
| <!-- ⏳/⚠️ -->   | <!-- one row per thing not checked, and why -->                           |
| Risk             | <!-- what it could break, or "none known" -->                             |

## 🧭 Where to look

<!-- The files that carry the design, in reading order; the rest in one line. -->

<!-- ## <emoji> <idea>: one heading per idea the reviewer must take in, in the order they need it. -->

## ⚖️ Decisions

<!-- Name the principle behind each decision, and each departure from one with its reason. -->

| Decision | Why | Alternative it beat |
| -------- | --- | ------------------- |

## 🚀 After the merge

- [ ] <!-- each step someone must take, or delete this section -->
