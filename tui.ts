import { Plugin } from "@opencode/plugin/tui"
import { ThinkGuard, type ThinkGuardViolation } from "./rpc.ts"

export default Plugin.define({
  id: "think-guard.tui",
  async setup(context) {
    const guard = context.client.rpc(ThinkGuard)

    const unsubscribe = guard.events.on("violated", (event) => {
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

    return () => unsubscribe()
  },
})
