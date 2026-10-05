# anti-overthink

![anti-overthink](https://gist.githubusercontent.com/creeper5820/f8dcc0735efa13edb9213328d8adea6f/raw/9b4a375496478fb3b7b04490c36c41c95f31f46d/anti-overthink.svg)

An OpenCode plugin that enforces a reasoning time limit. When a model's
thinking exceeds `thresholdMs`, the plugin interrupts the run, records an
unobtrusive notice in the session, and resumes the task. It does not pop up
toasts, system notifications, or sounds.

- Watches `session.reasoning.started` / `session.reasoning.ended` events for
  the models you configure.
- Times each reasoning stretch; only thinking is counted, not text output or
  tool calls.
- On timeout: interrupts the session, writes one system notice, and continues
  the task. No cap on the number of violations.
- Adds an optional **Anti-Overthink Mode** sidebar panel with live status.

## Requirements

- OpenCode v2 (`@opencode/plugin` 2.x).
- For the sidebar panel, `session.sidebar` must not be `hide` in
  `~/.config/opencode/cli.json` (use `auto`).

## Install

### From GitHub

```sh
opencode plugin add github:creeper5820/anti-overthink
```

Pin a release for stability:

```sh
opencode plugin add github:creeper5820/anti-overthink#<tag-or-commit>
```

`opencode plugin add` installs the package and registers it in
`~/.config/opencode/opencode.jsonc`. It writes a plain entry, so edit it into
the object form to pass options:

```jsonc
{
  "plugins": [
    {
      "package": "github:creeper5820/anti-overthink#<tag-or-commit>",
      "options": {
        "models": ["deepseek/deepseek-flash", "apiko/deepseek-v4.1-flash"],
        "thresholdMs": 10000,
        "alert": {
          "message": "Reasoning exceeded {seconds}s (violation #{count}). Execution was interrupted and the task continues."
        },
        "continuePrompt": "Continue the unfinished task. Be concise; avoid long internal reasoning."
      }
    }
  ]
}
```

Without options, `models` is empty and the plugin matches no model.

### From a local path

```jsonc
{
  "plugins": [
    { "package": "/absolute/path/to/anti-overthink", "options": { "models": ["deepseek/deepseek-flash"] } }
  ]
}
```

### From npm (once published)

```sh
opencode plugin add anti-overthink
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `models` | `string[]` | `[]` | Models to enforce, as `providerID/modelID` or bare `modelID`. Empty matches no model. |
| `thresholdMs` | `number` | `5000` | Maximum duration of a single reasoning stretch. |
| `alert.message` | `string` | built-in | Notice text. `{seconds}` is replaced with the measured duration and `{count}` with the session's violation number. |
| `continuePrompt` | `string` | built-in | Instruction sent to the model to resume the task after an interrupt. Also supports `{seconds}` and `{count}`. |

`ANTI_OVERTHINK_THRESHOLD_MS` overrides `thresholdMs`.

## Behavior

1. A `session.reasoning.started` event starts a timer for that session, but
   only when the session's model matches `models`.
2. `session.reasoning.ended` cancels the timer. The session's execution
   lifecycle (`succeeded` / `failed` / `interrupted`) clears any leftovers.
3. If the timer fires, the plugin calls `session.interrupt`, records one
   synthetic message, and lets `resume: true` continue the task.

The synthetic message has two parts:

- `text` — what the model receives: the notice plus `continuePrompt`.
- `description` — what the transcript shows: a muted system notice
  (`◇ Anti-Overthink · …`), not a user message.

This keeps the plugin's recovery out of your input history: no user prompt is
added. The only UI feedback is the transcript notice and the sidebar panel.

## Anti-Overthink Mode panel

When the active session's model matches `models`, the TUI sidebar shows an
**Anti-Overthink Mode** panel with live status:

```
Anti-Overthink Mode
model deepseek/deepseek-flash
limit 10.0s · violations 1
thinking 3.2s
last violation 12.4s
```

The current thinking time updates at 10 Hz; status is polled once per second
and refreshed immediately on a violation. Enable the sidebar with
`session.sidebar: "auto"` in `cli.json` if it is hidden.

The panel reads state through the `anti-overthink.status` RPC method. The same
method is callable over the HTTP API:

```sh
opencode api post /api/rpc/anti-overthink/status -d '{"input":{"sessionID":"ses_..."}}'
```

## Repository layout

```
index.ts    server entrypoint (timing, interrupt, notice, status RPC)
tui.tsx     CLI entrypoint (sidebar panel)
rpc.ts      shared RPC contract
```

Configuration changes reload automatically; changes under the plugin directory
are watched too.

## Development

```sh
npm install
npm run typecheck
```

The repo has no build step: OpenCode loads the TypeScript entrypoints directly.

## Troubleshooting

- **Panel missing** — set `session.sidebar` to `auto` in `cli.json`, and make
  sure the session's model is listed in `models`.
- **Nothing is interrupted** — `models` is empty by default; add
  `providerID/modelID` entries.
- **Model does not run** — the provider must be authenticated in OpenCode;
  the plugin only times a model that is already in use.

## License

MIT
