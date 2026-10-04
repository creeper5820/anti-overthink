import { createSignal, onCleanup, Show } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { AntiOverthink, type AntiOverthinkViolation } from "./rpc.ts"

type GuardStatus = {
  enforcing: boolean
  model: string
  thresholdMs: number
  violations: number
  active: boolean
  startedAt: number
  lastSeconds: number
  lastAt: number
}

export default Plugin.define({
  id: "anti-overthink.tui",
  async setup(context) {
    const guard = context.client.rpc(AntiOverthink)

    function Panel(props: { sessionID: string }) {
      const [status, setStatus] = createSignal<GuardStatus | undefined>()
      const [now, setNow] = createSignal(Date.now())

      const refresh = () => {
        const info = context.data.session.get(props.sessionID)
        const directory = info?.location?.directory
        guard
          .status({ sessionID: props.sessionID }, directory ? { location: { directory } } : undefined)
          .then((value) => setStatus(value as GuardStatus))
          .catch(() => {})
      }
      refresh()

      const clock = setInterval(() => setNow(Date.now()), 100)
      const poll = setInterval(refresh, 1000)

      const stopViolations = guard.events.on("violated", (event) => {
        const data = event.data as AntiOverthinkViolation
        if (data.sessionID === props.sessionID) refresh()
      })

      onCleanup(() => {
        clearInterval(clock)
        clearInterval(poll)
        stopViolations()
      })

      const elapsed = () => {
        const value = status()
        if (!value?.active || value.startedAt <= 0) return 0
        return Math.max(0, (now() - value.startedAt) / 1000)
      }
      const overdue = () => {
        const value = status()
        return value ? elapsed() > value.thresholdMs / 1000 : false
      }

      return (
        <Show when={status()?.enforcing}>
          <box flexDirection="column" paddingRight={2} gap={0}>
            <text fg={context.theme.text.base}>Anti-Overthink Mode</text>
            <text fg={context.theme.text.muted}>{`model ${status()!.model}`}</text>
            <text fg={context.theme.text.muted}>
              {`limit ${(status()!.thresholdMs / 1000).toFixed(1)}s · violations ${status()!.violations}`}
            </text>
            <Show when={status()!.active} fallback={<text fg={context.theme.text.muted}>idle</text>}>
              <text fg={overdue() ? context.theme.text.feedback.error.base : context.theme.text.base}>
                {`thinking ${elapsed().toFixed(1)}s`}
              </text>
            </Show>
            <Show when={status()!.lastSeconds > 0}>
              <text fg={context.theme.text.feedback.error.base}>
                {`last violation ${status()!.lastSeconds.toFixed(1)}s`}
              </text>
            </Show>
          </box>
        </Show>
      )
    }

    const disposeSlot = context.ui.slot({
      append: "sidebar.content",
      render: (props) => <Panel sessionID={props.sessionID} />,
    })

    return () => {
      disposeSlot()
    }
  },
})
