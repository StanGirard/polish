import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { Header } from './Header.js';
import { ScoreDisplay } from './Score.js';
import { AgentOutput } from './AgentOutput.js';
import { PolishProgress } from './PolishProgress.js';
import { Results } from './Results.js';
import { Init } from './Init.js';
import { loadConfig, resolveProvider } from '../config.js';
import { runAgentWithCallback } from '../agent.js';
import { runPolishLoopWithCallback } from '../polish-loop.js';
import {
  isGitRepo,
  getCurrentBranch,
  createWorktree,
  removeWorktree,
  createBranchFromWorktree,
  generatePolishBranchName,
  type WorktreeInfo,
} from '../git.js';
import { isInitialized } from '../settings.js';
import type { CliOptions, PolishResult, ScoreResult, AnyActivity, ToolActivity } from '../types.js';

type Phase = 'check-init' | 'init' | 'running' | 'implement' | 'polish' | 'done' | 'error';

interface AppProps {
  mission?: string;
  options: CliOptions;
}

export function App({ mission, options }: AppProps) {
  const { exit } = useApp();

  const [phase, setPhase] = useState<Phase>('check-init');
  const [branch, setBranch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Activity log for streaming output
  const [activities, setActivities] = useState<AnyActivity[]>([]);

  // Helper functions for activity management
  const addTextActivity = (content: string) => {
    setActivities((prev) => [
      ...prev,
      {
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  const addToolActivity = (id: string, name: string, displayText: string) => {
    setActivities((prev) => [
      ...prev,
      {
        id,
        type: 'tool',
        name,
        displayText,
        status: 'running',
        timestamp: Date.now(),
      } as ToolActivity,
    ]);
  };

  const updateToolActivity = (
    id: string,
    success: boolean,
    output?: string,
    error?: string,
    duration?: number
  ) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id && a.type === 'tool'
          ? {
              ...a,
              status: success ? 'done' : 'error',
              result: output,
              error,
              duration,
            }
          : a
      )
    );
  };

  const addStatusActivity = (message: string, variant: 'info' | 'success' | 'warning' | 'error') => {
    setActivities((prev) => [
      ...prev,
      {
        id: `status-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'status',
        message,
        variant,
        timestamp: Date.now(),
      },
    ]);
  };

  const clearActivities = () => {
    setActivities([]);
  };

  // Polish state
  const [currentScore, setCurrentScore] = useState<ScoreResult | null>(null);
  const [iteration, setIteration] = useState(0);
  const [maxIterations, setMaxIterations] = useState(50);
  const [improving, setImproving] = useState<string | null>(null);
  const [result, setResult] = useState<PolishResult | null>(null);

  // Worktree state for cleanup on exit
  const [worktreeInfo, setWorktreeInfo] = useState<WorktreeInfo | null>(null);

  // Check initialization on mount
  useEffect(() => {
    if (phase === 'check-init') {
      if (isInitialized()) {
        setPhase('running');
      } else {
        setPhase('init');
      }
    }
  }, [phase]);

  // Cleanup worktree on SIGINT/SIGTERM
  useEffect(() => {
    const cleanup = () => {
      if (worktreeInfo) {
        removeWorktree(worktreeInfo.path).catch(() => {});
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return () => {
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
    };
  }, [worktreeInfo]);

  // Run main logic
  useEffect(() => {
    if (phase !== 'running') return;

    async function run() {
      try {
        // Check git repo
        if (!(await isGitRepo())) {
          setError('Not a git repository');
          setPhase('error');
          return;
        }

        setBranch(await getCurrentBranch());

        // Load config
        const config = loadConfig(options.config);
        config.target = parseInt(options.target, 10);
        config.maxIterations = parseInt(options.maxIterations, 10);
        setMaxIterations(config.maxIterations);

        // Resolve provider from CLI options and config
        const provider = resolveProvider(config, options.provider, options.model, options.baseUrl);

        // Validate inputs
        if (!mission && !options.polishOnly) {
          setError('Please provide a mission or use --polish-only');
          setPhase('error');
          return;
        }

        // Phase 1: Implementation
        if (!options.polishOnly && mission) {
          setPhase('implement');
          clearActivities();

          const implementPrompt = `You are working on this codebase. Your mission is:

${mission}

First, explore the codebase to understand its structure. Then implement the requested changes.

Guidelines:
1. Read existing code to understand patterns and conventions
2. Make minimal, focused changes
3. Follow existing code style
4. Ensure your changes work with existing code`;

          await runAgentWithCallback(implementPrompt, {
            onText: addTextActivity,
            onToolStart: addToolActivity,
            onToolDone: updateToolActivity,
          }, { provider });
        }

        // Phase 2: Polish loop
        if (options.polish !== false) {
          setPhase('polish');
          clearActivities();

          // Update config with resolved provider for polish loop
          config.provider = provider;

          // Create worktree for isolated polish work
          const currentBranch = await getCurrentBranch();
          const worktree = await createWorktree(currentBranch);
          setWorktreeInfo(worktree);
          addStatusActivity(`Created worktree at ${worktree.path}`, 'info');

          let polishResult: PolishResult;
          try {
            polishResult = await runPolishLoopWithCallback(config, {
              onScore: (score) => setCurrentScore(score),
              onIteration: (i) => setIteration(i),
              onImproving: (metric) => setImproving(metric),
              onAgentText: addTextActivity,
              onAgentToolStart: addToolActivity,
              onAgentToolDone: updateToolActivity,
              onCommit: (hash) => {
                addStatusActivity(`Committed: ${hash}`, 'success');
              },
              onRollback: () => {
                addStatusActivity('Changes rolled back', 'warning');
              },
            }, { worktreePath: worktree.path });

            // If there were commits, create a branch from the worktree
            if (polishResult.commits.length > 0) {
              const branchName = generatePolishBranchName();
              await createBranchFromWorktree(worktree.path, branchName);
              polishResult.branchName = branchName;
              addStatusActivity(`Created branch: ${branchName}`, 'success');
            }
          } finally {
            // Always clean up worktree
            await removeWorktree(worktree.path);
            setWorktreeInfo(null);
          }

          setResult(polishResult);
        }

        setPhase('done');
      } catch (err) {
        // Clean up worktree on error
        if (worktreeInfo) {
          await removeWorktree(worktreeInfo.path).catch(() => {});
          setWorktreeInfo(null);
        }
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    }

    run();
  }, [phase, mission, options]);

  // Exit after showing results
  useEffect(() => {
    if (phase === 'done' || phase === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [phase, exit]);

  // Show init screen if not initialized
  if (phase === 'init') {
    return (
      <Init
        onComplete={() => setPhase('running')}
        onCancel={() => exit()}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header branch={branch} />

      {(phase === 'check-init' || phase === 'running') && (
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Initializing...</Text>
        </Box>
      )}

      {phase === 'implement' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="blue">
            {'─'.repeat(40)}
          </Text>
          <Text bold color="blue">
            Implementation
          </Text>
          <Text color="dim">{mission}</Text>
          <Box marginTop={1} flexDirection="column">
            <AgentOutput activities={activities} />
          </Box>
        </Box>
      )}

      {phase === 'polish' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            {'─'.repeat(40)}
          </Text>
          <Text bold color="yellow">
            Polish Loop
          </Text>

          {currentScore && (
            <Box marginTop={1}>
              <ScoreDisplay score={currentScore} target={parseInt(options.target, 10)} />
            </Box>
          )}

          <PolishProgress
            iteration={iteration}
            maxIterations={maxIterations}
            improving={improving}
          />

          <Box marginTop={1} flexDirection="column">
            <AgentOutput activities={activities} />
          </Box>
        </Box>
      )}

      {phase === 'done' && result && (
        <Box marginTop={1}>
          <Results result={result} />
        </Box>
      )}

      {phase === 'error' && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
