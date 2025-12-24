import { task, logger } from "@trigger.dev/sdk/v3"
import { clone, createBranch, createTempDir, cleanupTempDir } from "../lib/git"
import { detectStack, loadPreset, mergeConfig } from "../lib/detector"
import { runPolishLoop } from "../lib/loop"
import { exec } from "../lib/executor"
import type { Config, JobResult } from "../lib/types"

interface PolishPayload {
  repoUrl: string
  githubToken: string
  duration?: number // seconds, default 3600 (1 hour)
  configOverride?: Partial<Config>
}

export const polishTask = task({
  id: "polish-repo",
  maxDuration: 7200, // 2 hours max
  run: async (payload: PolishPayload): Promise<JobResult> => {
    const {
      repoUrl,
      githubToken,
      duration = 3600,
      configOverride,
    } = payload

    const tempDir = createTempDir()
    logger.info("Created temp directory", { tempDir })

    try {
      // 1. Clone the repo
      logger.info("Cloning repository", { repoUrl })
      await clone(repoUrl, tempDir, githubToken)
      logger.info("Repository cloned successfully")

      // 2. Detect stack
      logger.info("Detecting project stack...")
      const stack = await detectStack(tempDir)
      logger.info("Detected stack", { stack })

      // 3. Load preset
      logger.info("Loading preset configuration...")
      let config = await loadPreset(stack)

      // 4. Merge config override if provided
      if (configOverride) {
        config = mergeConfig(config, configOverride)
        logger.info("Applied config override")
      }

      // 5. Create polish branch
      const branchName = `polish/auto-${Date.now()}`
      logger.info("Creating branch", { branchName })
      await createBranch(tempDir, branchName)

      // 6. Install dependencies
      logger.info("Installing dependencies...")
      const installResult = await exec("npm install", tempDir, 300000) // 5 min timeout
      if (installResult.exitCode !== 0) {
        logger.warn("npm install had issues", { stderr: installResult.stderr })
      }

      // 7. Run polish loop
      logger.info("Starting polish loop", { duration })
      const result = await runPolishLoop(tempDir, config, {
        duration,
        githubToken,
        repoUrl,
        onProgress: (state) => {
          logger.info("Progress update", {
            iteration: state.iteration,
            score: state.scoreHistory[state.scoreHistory.length - 1] || 0,
            commits: state.commits.length,
          })
        },
      })

      logger.info("Polish completed", {
        scoreBefore: result.scoreBefore,
        scoreAfter: result.scoreAfter,
        iterations: result.iterations,
        commits: result.commits.length,
        prUrl: result.prUrl,
      })

      return result

    } finally {
      // Cleanup temp directory
      logger.info("Cleaning up temp directory")
      await cleanupTempDir(tempDir)
    }
  },
})
