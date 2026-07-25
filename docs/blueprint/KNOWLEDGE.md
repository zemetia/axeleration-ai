# Knowledge System

Two files in `docs/knowledge/` capture learned context that is not derivable from the code or git history.

| File | Purpose | When to write |
|---|---|---|
| [THIS.md](../knowledge/THIS.md) | Project identity, developer style, do's & don'ts, ongoing insights | Whenever a new preference, pattern, or insight is discovered about the project or developer |
| [LEARN.md](../knowledge/LEARN.md) | Correction & mistake log | Whenever the user corrects the AI **or** the AI self-identifies a deviation from what was asked / from best practice |

---

## THIS.md — How to Use

- Read before planning work, alongside the relevant blueprint section
- Write new entries to the **Insights** section with a date prefix
- Mark outdated entries with `~~strikethrough~~` — never delete

---

## LEARN.md — Entry Format

```
[YYYY-MM-DD] - [what went wrong] - [what the correct approach is] - [the transferable lesson]
```

Keep each entry to one line. Prioritize the lesson — the part that prevents the same mistake next time.

**Triggers for writing:**
- User says the AI was wrong, did something unwanted, or missed the intent
- AI produced output that violated a blueprint rule or non-negotiable
- AI added something not asked for (extra files, comments, abstraction, emojis)
- AI used a forbidden pattern (raw color, wrong navigation import, `useState` for API data, etc.)

---

## Priority

This system is **the most important** context layer after CLAUDE.md itself. AI agents must:

1. Check `THIS.md` for developer/project context before every task
2. Check `LEARN.md` for past mistakes before writing any code
3. Append to both files whenever new knowledge is generated
