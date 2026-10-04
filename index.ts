import { Plugin } from "@opencode/plugin"
import { ThinkGuard } from "./rpc.ts"

type ActiveReasoning = {
  sessionID: string
  model: string
  started: number
  timer: ReturnType<typeof setTimeout>
}

type GuardOptions = {
  models?: string[]
  thresholdMs?: number
  continuePrompt?: string
  alert?: {
    message?: string
  }
}

const DEFAULTS = {
  models: [] as string[],
  thresholdMs: 5000,
  continuePrompt: "继续未完成的任务。保持简洁，避免长时间内部推理。",
  alert: {
    message: "推理超过 {seconds}s，已强制终止本轮执行，任务继续。禁止再次超时。",
  },
}

export default Plugin.define({
  id: "think-guard",
  async setup(ctx) {
    const raw = (ctx.options ?? {}) as GuardOptions

    const envThreshold = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.THINK_GUARD_THRESHOLD_MS
    const thresholdMs = Math.max(
      1,
      Number(envThreshold ?? raw.thresholdMs ?? DEFAULTS.thresholdMs),
    )
    const models = (Array.isArray(raw.models) ? raw.models : DEFAULTS.models).map(String)
    const continuePrompt =
      typeof raw.continuePrompt === "string" && raw.continuePrompt.trim().length > 0
        ? raw.continuePrompt
        : DEFAULTS.continuePrompt
    const alert = {
      message: raw.alert?.message ?? DEFAULTS.alert.message,
    }

    const matchesModel = (key: string) => {
      const modelID = key.includes("/") ? key.slice(key.indexOf("/") + 1) : key
      return models.some((entry) => entry === key || entry === modelID)
    }

    const sessionModel = new Map<string, string>()
    const active = new Map<string, ActiveReasoning>()
    const interrupting = new Set<string>()
    const counts = new Map<string, number>()
    const lastViolation = new Map<string, { seconds: number; at: number; model: string }>()

    const partKey = (sessionID: string, messageID: string, ordinal: number) =>
      `${sessionID}:${messageID}:${ordinal}`

    const registration = await ctx.rpc.register(ThinkGuard, {
      status: async (input) => {
        const sessionID = (input as { sessionID: string }).sessionID
        let model = sessionModel.get(sessionID) ?? ""
        if (!model) {
          try {
            const info = await ctx.session.get({ sessionID })
            if (info?.model?.providerID && info?.model?.id) {
              model = `${info.model.providerID}/${info.model.id}`
              sessionModel.set(sessionID, model)
            }
          } catch {
            // session may not exist yet
          }
        }
        const activeEntry = [...active.values()].find((entry) => entry.sessionID === sessionID)
        const last = lastViolation.get(sessionID)
        return {
          enforcing: model !== "" && matchesModel(model),
          model,
          thresholdMs,
          violations: counts.get(sessionID) ?? 0,
          active: activeEntry !== undefined,
          startedAt: activeEntry?.started ?? 0,
          lastSeconds: last?.seconds ?? 0,
          lastAt: last?.at ?? 0,
        }
      },
    })

    function clearKey(key: string) {
      const entry = active.get(key)
      if (entry) {
        clearTimeout(entry.timer)
        active.delete(key)
      }
      interrupting.delete(key)
    }

    function clearSession(sessionID: string) {
      for (const [key, entry] of [...active]) {
        if (entry.sessionID === sessionID) clearKey(key)
      }
      for (const key of [...interrupting]) {
        if (key.startsWith(`${sessionID}:`)) interrupting.delete(key)
      }
    }

    async function onTimeout(key: string) {
      const entry = active.get(key)
      if (!entry) return
      if (interrupting.has(key)) return
      interrupting.add(key)
      clearTimeout(entry.timer)
      active.delete(key)

      const sessionID = entry.sessionID
      const seconds = Math.round(((Date.now() - entry.started) / 1000) * 10) / 10
      const count = (counts.get(sessionID) ?? 0) + 1
      counts.set(sessionID, count)
      lastViolation.set(sessionID, { seconds, at: Date.now(), model: entry.model })

      try {
        await ctx.session.interrupt({ sessionID })
      } catch (error) {
        console.error("[think-guard] interrupt failed", error)
      }

      const message = alert.message.replaceAll("{seconds}", String(seconds))

      try {
        await ctx.session.synthetic({
          sessionID,
          text: `[think-guard] ${message}\n${continuePrompt}`,
          description: `Think Guard · ${message}`,
          resume: true,
        })
      } catch (error) {
        console.error("[think-guard] synthetic failed", error)
      }

      try {
        await registration.events.emit("violated", {
          sessionID,
          model: entry.model,
          seconds,
          count,
        })
      } catch (error) {
        console.error("[think-guard] alert emit failed", error)
      }

      interrupting.delete(key)
    }

    await ctx.session.hook("model.request", (event) => {
      if (event.kind !== "primary") return
      sessionModel.set(event.sessionID, `${event.model.providerID}/${event.model.id}`)
    })

    const controller = new AbortController()
    const pump = (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const data = event.data as Record<string, any> | undefined
          switch (event.type) {
            case "session.model.selected": {
              if (data?.model?.providerID && data?.model?.id) {
                sessionModel.set(data.sessionID, `${data.model.providerID}/${data.model.id}`)
              }
              break
            }
            case "session.reasoning.started": {
              if (!data) break
              const key = partKey(data.sessionID, data.assistantMessageID, data.ordinal)
              clearKey(key)
              const model = sessionModel.get(data.sessionID)
              if (!model || !matchesModel(model)) break
              const started = Date.now()
              const timer = setTimeout(() => void onTimeout(key), thresholdMs)
              active.set(key, { sessionID: data.sessionID, model, started, timer })
              break
            }
            case "session.reasoning.ended": {
              if (!data) break
              clearKey(partKey(data.sessionID, data.assistantMessageID, data.ordinal))
              break
            }
            case "session.execution.interrupted":
            case "session.execution.succeeded":
            case "session.execution.failed": {
              if (data?.sessionID) clearSession(data.sessionID)
              break
            }
            case "session.deleted": {
              if (data?.sessionID) {
                clearSession(data.sessionID)
                sessionModel.delete(data.sessionID)
                counts.delete(data.sessionID)
                lastViolation.delete(data.sessionID)
              }
              break
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("[think-guard] event stream failed", error)
      }
    })()

    return async () => {
      controller.abort()
      for (const key of [...active.keys()]) clearKey(key)
      await registration.dispose()
      void pump
    }
  },
})
