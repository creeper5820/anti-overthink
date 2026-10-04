# opencode-think-guard

OpenCode plugin that enforces a reasoning time limit:

1. Watches reasoning (thinking) events for configured models.
2. When a single reasoning stretch exceeds `thresholdMs`, it interrupts the running session.
3. Raises a strong alert: TUI toast, system notification, sound, and a `[think-guard]` message in the session.
4. Resumes the task automatically with a continue prompt. No violation count limit.

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
          "title": "THINK LIMIT VIOLATION",
          "message": "Reasoning exceeded {seconds}s. Execution was interrupted and the task continues.",
          "variant": "error",
          "sound": { "name": "error", "when": "always" }
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
| `alert.title` | `string` | `THINK LIMIT VIOLATION` | Alert title. |
| `alert.message` | `string` | built-in | Alert text; `{seconds}` is replaced with the measured duration. |
| `alert.variant` | `string` | `error` | Toast variant: `info`, `success`, `warning`, or `error`. |
| `alert.sound` | `object \| boolean` | `{ name: "error", when: "always" }` | Notification sound; set `false` to disable. |
| `continuePrompt` | `string` | built-in | Prompt sent to resume the task after an interrupt. |

`THINK_GUARD_THRESHOLD_MS` overrides `thresholdMs`.

## Behavior

- Only `session.reasoning.started` / `session.reasoning.ended` events are timed; text output and tool calls are not counted.
- One timer per reasoning part; ending before the limit cancels it.
- Violations are unlimited: the guard interrupts, alerts, and resumes on every timeout.

## Development

```sh
npm install
```

The plugin loads as a local OpenCode plugin: `index.ts` is the server entrypoint, `tui.ts` is the CLI entrypoint, and `rpc.ts` is the shared contract.

## License

MIT
