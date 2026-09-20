# CAPTURE-TEST

Proof that automatic prompt/response capture is installed and firing.

## 1. Tool and model

| | |
|---|---|
| **Tool** | Claude Code `2.1.273` (VS Code extension, `anthropic.claude-code-2.1.273-win32-x64`) |
| **Model (planning and execution)** | `claude-opus-5` — a single model does both. No separate planner/executor split. |
| **Subagent model** | `claude-opus-5` (inherited). Subagent turns are **not** logged — `SubagentStop` is deliberately not wired, since subagent output is an intermediate step, not a final response. |
| **OS / shell** | Windows 11, Git Bash + PowerShell |
| **Automatic mechanism available?** | Yes — Claude Code has a first-class hooks system. Confirmed against https://code.claude.com/docs/en/hooks.md before building anything. |

## 2. Mechanism

Two lifecycle hooks, both defined in a **committed, project-scoped** config file so they
apply to every session started in this repo — including sessions that did not create them.

**Config file changed:** [.claude/settings.json](.claude/settings.json)

| Hook event | Fires | Field used |
|---|---|---|
| `UserPromptSubmit` | when a prompt is submitted, before the model sees it | `prompt` — the verbatim prompt text |
| `Stop` | when the model finishes its turn | `last_assistant_message` — the complete final response |

Both point at [.claude/hooks/capture.js](.claude/hooks/capture.js), which appends to
`.agent-logs/`. Nothing has to be remembered or run by hand.

`Stop` giving `last_assistant_message` directly is what makes this clean: the final
response text is handed to the hook, so the log contains the prompt and the final answer
and **nothing in between** — no thinking, no tool calls, no file reads, no retries.

### Why exec form and not a shell command

The hooks use exec form (`"command": "node"` plus an `args` array) rather than a single
shell string. Two Windows-specific reasons:

1. This project path contains a space (`D:\8x Amazon`), which is a quoting hazard in shell form.
2. On Windows, shell-form hook commands are handed to **PowerShell**, where `$CLAUDE_PROJECT_DIR`
   is a PowerShell variable, not an environment variable — it expands to empty. PowerShell
   needs `$env:CLAUDE_PROJECT_DIR`. Exec form sidesteps this: `${CLAUDE_PROJECT_DIR}` is
   substituted literally by Claude Code before the process is spawned.

I verified `args` is supported by this exact version rather than assuming it, by reading the
schema bundled with the installed extension (`claude-code-settings.schema.json`):

```
HOOK DEF at /properties/hooks/additionalProperties/items/properties/hooks/items/anyOf/0
  -> keys: type,command,args,if,shell,timeout,statusMessage,once,async,asyncRewake
```

### Safety property

The hook can never break a session. `main()` is wrapped in `try/catch`, the process always
`exit(0)`, and any failure is appended to `.agent-logs/.capture-errors.log` instead of being
swallowed silently. That file is currently empty — no errors have occurred.

## 3. Where the canaries landed

Two canaries, in **two different sessions**, neither of which was the session that installed
the hook:

| Canary | Session | Log file |
|---|---|---|
| 1st | `109caa2a` | [.agent-logs/2026-09-20_15-58-35_109caa2a.md](.agent-logs/2026-09-20_15-58-35_109caa2a.md) |
| 2nd | `29922eea` | [.agent-logs/2026-09-20_16-00-24_29922eea.md](.agent-logs/2026-09-20_16-00-24_29922eea.md) |

Both were run as genuinely separate processes via the CLI binary, so this is not a
hook that only works in the session that created it:

```bash
claude.exe -p "CAPTURE TEST — 8x assignment, Farhan Khan. ..."
```

Separately, [.agent-logs/2026-09-20_15-58-14_c4110ea9.md](.agent-logs/2026-09-20_15-58-14_c4110ea9.md)
is the **setup session itself** being captured — the hook started firing mid-session as soon
as `settings.json` was written, without a restart.

### Canary 1 — session `109caa2a`, pasted raw

```
[LOG_ENTRY type=PROMPT num=1 session=109caa2a]
timestamp: 2026-09-20T15:58:35.794Z
model: unknown

CAPTURE TEST — 8x assignment, Farhan Khan. Reply with one short sentence confirming you received this canary. Do not use any tools.


[LOG_ENTRY type=RESPONSE num=1 session=109caa2a]
timestamp: 2026-09-20T15:58:37.740Z
model: unknown

Canary received — 8x assignment, Farhan Khan, confirmed.
```

### Canary 2 — session `29922eea`, pasted raw

```
[LOG_ENTRY type=PROMPT num=1 session=29922eea]
timestamp: 2026-09-20T16:00:24.113Z
model: unknown

CAPTURE TEST — 8x assignment, Farhan Khan (second session canary). Reply with one short sentence. No tools.


[LOG_ENTRY type=RESPONSE num=1 session=29922eea]
timestamp: 2026-09-20T16:00:26.303Z
model: claude-opus-5

Canary received — second session capture test for Farhan Khan's 8x assignment logged, no tools used.
```

Canary 1 says `model: unknown` on both entries and canary 2 says `claude-opus-5` on the
response. That difference is the model-resolution fix landing between the two runs — see below.
Both canaries are left exactly as they were written.

## 4. What I tried first that did not work

**Assuming the end-of-turn hook meant parsing the transcript.** The brief says the end-of-turn
hook "receives a path to the session transcript on stdin", so my first design parsed the
transcript JSONL backwards looking for the last assistant text block. Dumping a real payload
showed `Stop` also passes `last_assistant_message` — the complete final response, already
assembled. That is both simpler and more correct, because the transcript is flushed
asynchronously and lags behind the live conversation. The transcript parser survives only as
a fallback in `responseFromTranscript()`.

**Trusting a subagent's answer about where the model name lives.** I delegated a docs lookup,
and the report came back stating the model "is not stored in individual transcript entries"
and recommending the `ANTHROPIC_MODEL` environment variable. That is wrong. Checking an actual
transcript took one command and showed `message.model` on every assistant entry:

```
models seen: claude-opus-5
```

Had I taken the report at face value, every log entry would read `unknown`, because
`ANTHROPIC_MODEL` is not set in this environment.

**Model came out as `unknown` on fresh sessions.** The first working version resolved the model
from the transcript, which is correct from turn 2 onward but returned `unknown` for a brand-new
session — visible in canary 1 above, and in the `caf084a1` log. The cause was flush lag, not a
missing field: the same transcript contained `claude-opus-5` when re-read seconds later. Fixed
with a bounded retry (up to 15 × 200 ms) that runs **only** at `Stop` and **only** when no model
has been found yet, so it costs nothing on a normal turn. Canary 2 is the same test after the fix.

**Hoping the hook payload carried the model directly.** Before adding the retry I checked, by
temporarily wiring a second hook that dumped raw stdin. It does not:

```
UserPromptSubmit => session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, hook_event_name, prompt
Stop => session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, effort, hook_event_name, stop_hook_active, last_assistant_message, background_tasks, session_crons
```

The transcript is the only source. The dump hook was removed afterwards; the `caf084a1` log is
the session that produced this output, left in place.

**Frontmatter grew a blank line on every append.** Caught in offline testing, not in production.
The hook rewrites the frontmatter each turn to update `total_exchanges` and `last_prompt_time`,
and the regex that stripped the old block did not consume the blank line after the closing `---`,
so one accumulated per entry. Fixed by making the regex swallow that newline; re-tested over
three append cycles to confirm the spacing is now stable.

**`claude` was not on `PATH`.** I could not shell out to start a second session, which is the
only way to prove the hook is not session-local. The CLI ships inside the VS Code extension:
`~/.vscode/extensions/anthropic.claude-code-2.1.273-win32-x64/resources/native-binary/claude.exe`.
An initial recursive filesystem search for it was too broad and blew its timeout; targeted
directory checks found it in seconds.

**Writing `capture.js` via a Bash heredoc.** Quote imbalance in the script body kept breaking the
heredoc. Not worth fighting — used the file-write tool instead.

## 5. Known limitations, stated up front

- **The first `PROMPT` entry of a session always reads `model: unknown`.** At the moment a prompt
  is submitted, no assistant entry exists yet, so the model is genuinely not yet knowable from any
  source available to the hook. I deliberately did not add a retry here, because that would delay
  the start of every turn. The `RESPONSE` entry for that same turn, and the frontmatter, both carry
  the real model, and a mid-build model switch is still visible on every entry after the first.
- **System-injected turns are logged as prompts.** Background-task notifications re-invoke the model
  and arrive through `UserPromptSubmit`, so they appear as `PROMPT` entries and count toward
  `total_exchanges` — see the first entry in the `c4110ea9` log. I chose not to filter these: any
  filter risks silently dropping a real prompt, which is a much worse failure than a little noise.
- **`.agent-logs/` is not, and will not be, gitignored.** It ships with the repo.
