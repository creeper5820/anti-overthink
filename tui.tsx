import { createSignal, onCleanup, Show } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { ThinkGuard, type ThinkGuardViolation } from "./rpc.ts"

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
  id: "think-guard.tui",
  async setup(context) {
    const guard = context.client.rpc(ThinkGuard)

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

      const timer = setInterval(() => {
        setNow(Date.now())
        refresh()
      }, 500)

      const stopViolations = guard.events.on("violated", (event) => {
        const data = event.data as ThinkGuardViolation
        if (data.sessionID === props.sessionID) refresh()
      })

      onCleanup(() => {
        clearInterval(timer)
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
            <text fg={context.theme.text.base}>Think Guard Mode</text>
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

    const stopViolations = guard.events.on("violated", (event) => {
      const data = event.data as ThinkGuardViolation
      context.ui.toast.show({
        title: data.title ?? "THINK LIMIT VIOLATION",
        message: data.message,
        variant: data.variant ?? "error",
        duration: 10_000,
        sessionID: data.sessionID,
      })

      void context.attention.notify({
        title: data.title ?? "THINK LIMIT VIOLATION",
        message: data.message,
        notification: { when: "always" },
        sound: {
          name: (data.sound?.name as never) ?? "error",
          when: data.sound?.when ?? "always",
        },
      })
    })

    return () => {
      disposeSlot()
      stopViolations()
    }
  },
})
