# opencode-think-guard

OpenCode plugin that enforces a reasoning time limit:

1. Watches reasoning (thinking) events for configured models.
2. When a single reasoning stretch exceeds `thresholdMs`, it interrupts the running session.
3. Records an unobtrusive notice in the session; the task resumes automatically. No popups, notifications, or sounds.
4. No violation count limit.

## Install

Add the plugin to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-think-guard",
      "options": {
        "models": ["apiko/deepseek-v4.1-flash"],
        "thresholdMs": 5000,
        "alert": {
          "message": "Reasoning exceeded {seconds}s. Execution was interrupted and the task continues."
        },
        "continuePrompt": "Continue the unfinished task. Be concise; avoid long internal reasoning."
      }
    }
  ]
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `models` | `string[]` | `[]` | Models to enforce, as `providerID/modelID` or bare `modelID`. Empty matches no model. |
| `thresholdMs` | `number` | `5000` | Maximum duration of a single reasoning stretch. |
| `alert.message` | `string` | built-in | Notice text; `{seconds}` is replaced with the measured duration. |
| `continuePrompt` | `string` | built-in | Instruction sent to the model to resume the task after an interrupt. |

`THINK_GUARD_THRESHOLD_MS` overrides `thresholdMs`.

## Behavior

- Only `session.reasoning.started` / `session.reasoning.ended` events are timed; text output and tool calls are not counted.
- One timer per reasoning part; ending before the limit cancels it.
- Violations are unlimited: the guard interrupts and resumes on every timeout.
- Recovery uses a single synthetic message with `resume: true`. Its `description` renders as an unobtrusive system notice (`◇` + muted text) in the transcript; its `text` is what the model receives. No user prompt is added, so your input history stays yours.
- No toast, system notification, or sound is produced; the only UI feedback is the transcript notice and the sidebar panel.

## Think Guard Mode panel

When the active session's model matches `models`, the TUI sidebar shows a **Think Guard Mode** panel with live status: guarding model, limit, violation count, current thinking time, and the last violation. Enable the sidebar with `session.sidebar: "auto"` in `cli.json` if it is hidden.

The panel reads state through the `think-guard.status` RPC method; `status` is also callable over the HTTP API.

## Development

```sh
npm install
```

The plugin loads as a local OpenCode plugin: `index.ts` is the server entrypoint, `tui.tsx` is the CLI entrypoint, and `rpc.ts` is the shared contract.

## License

MIT
