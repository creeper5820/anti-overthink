// Runtime-free RPC contract. `Rpc.define` is an identity helper, so the
// definition is declared inline to keep this module importable from the CLI
// entrypoint without resolving any package.
export const ThinkGuard = {
  id: "think-guard",
  methods: {},
  events: {
    violated: {
      schema: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          model: { type: "string" },
          seconds: { type: "number" },
          count: { type: "number" },
          title: { type: "string" },
          message: { type: "string" },
          variant: { type: "string", enum: ["info", "success", "warning", "error"] },
          sound: {
            type: "object",
            properties: {
              name: { type: "string" },
              when: { type: "string", enum: ["always", "focused", "blurred"] },
            },
            additionalProperties: false,
          },
        },
        required: ["sessionID", "model", "seconds", "message", "variant"],
        additionalProperties: false,
      },
    },
  },
} as const

export type ThinkGuardViolation = {
  sessionID: string
  model: string
  seconds: number
  count?: number
  title?: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  sound?: { name?: string; when?: "always" | "focused" | "blurred" }
}
