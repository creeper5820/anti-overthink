// Runtime-free RPC contract. `Rpc.define` is an identity helper, so the
// definition is declared inline to keep this module importable from the CLI
// entrypoint without resolving any package.
export const ThinkGuard = {
  id: "think-guard",
  methods: {
    status: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          enforcing: { type: "boolean" },
          model: { type: "string" },
          thresholdMs: { type: "number" },
          violations: { type: "number" },
          active: { type: "boolean" },
          startedAt: { type: "number" },
          lastSeconds: { type: "number" },
          lastAt: { type: "number" },
        },
        required: [
          "enforcing",
          "model",
          "thresholdMs",
          "violations",
          "active",
          "startedAt",
          "lastSeconds",
          "lastAt",
        ],
        additionalProperties: false,
      },
    },
  },
  events: {
    violated: {
      schema: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          model: { type: "string" },
          seconds: { type: "number" },
          count: { type: "number" },
        },
        required: ["sessionID", "model", "seconds"],
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
}
