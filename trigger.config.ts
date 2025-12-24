import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: "polish",
  runtime: "node",
  logLevel: "log",
  maxDuration: 7200, // 2 hours max
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
    },
  },
  dirs: ["./trigger"],
})
