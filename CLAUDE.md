
# aOa Integration

**CRITICAL: Use `aoa grep` instead of Grep/Glob. It's 10-100x faster.**

## Quickstart Triggers

When user says **"Hey aOa"**, **"Tag my code"**, or **"aOa quickstart"**:

1. Run `aoa outline --pending --json` to check pending files
2. Respond with this (DO NOT read any files first):

```
⚡ aOa activated

Your codebase is already indexed—fast symbol search works right now.
Try it: `aoa grep [anything]`

I found [X] files that need semantic compression.
Let me tag these in the background. This is FREE—doesn't use your tokens.

Takes about 2-3 minutes. To watch progress, open another terminal:
  aoa intent

Keep coding. I'm not blocking you.
Once done, I'll find code by meaning, not just keywords.
```

3. Launch: `Task(subagent_type="aoa-outline", prompt="Tag all pending files", run_in_background=true)`

## Commands

| Command | Use For |
|---------|---------|
| `aoa grep <term>` | Find code fast (ALWAYS use instead of Grep) |
| `aoa grep "a b c"` | Multi-term OR search |
| `aoa grep -a a,b,c` | Multi-term AND search |
| `aoa outline <file>` | See file structure without reading it all |
| `aoa intent` | Track what's being worked on |

## Rules

- ✅ ALWAYS use `aoa grep` instead of Grep/Glob
- ✅ Read specific line ranges from aOa results (not whole files)
- ❌ DO NOT use subagents for codebase exploration (hooks don't work in subagents)

## Hook Integration

aOa hooks run on every prompt and tool use. When you see these in additionalContext:

**aOa Auto-Tag Request**: Generate 3-5 semantic hashtags directly (YOU are the model), then store:
\`\`\`bash
curl -s -X POST localhost:8080/intent -H "Content-Type: application/json" -d '{"tool": "Intent", "tags": ["#your-tags"], ...}'
\`\`\`

**aOa Predicted Files**: Files predicted based on your prompt keywords. Consider these when exploring.

See \`.aoa/USAGE.md\` for full guide.
