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
import { isGitRepo, getCurrentBranch } from '../git.js';
import { isInitialized } from '../settings.js';
import type { CliOptions, PolishResult, ScoreResult } from '../types.js';

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

  // Agent state
  const [agentText, setAgentText] = useState<string>('');
  const [agentTool, setAgentTool] = useState<string | null>(null);

  // Polish state
  const [currentScore, setCurrentScore] = useState<ScoreResult | null>(null);
  const [iteration, setIteration] = useState(0);
  const [maxIterations, setMaxIterations] = useState(50);
  const [improving, setImproving] = useState<string | null>(null);
  const [result, setResult] = useState<PolishResult | null>(null);

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

          const implementPrompt = `You are working on this codebase. Your mission is:

${mission}

First, explore the codebase to understand its structure. Then implement the requested changes.

Guidelines:
1. Read existing code to understand patterns and conventions
2. Make minimal, focused changes
3. Follow existing code style
4. Ensure your changes work with existing code`;

          await runAgentWithCallback(implementPrompt, {
            onText: (text) => setAgentText((prev) => prev + text),
            onTool: (tool) => setAgentTool(tool),
            onToolDone: () => setAgentTool(null),
          }, { provider });

          setAgentText('');
          setAgentTool(null);
        }

        // Phase 2: Polish loop
        if (options.polish !== false) {
          setPhase('polish');

          // Update config with resolved provider for polish loop
          config.provider = provider;

          const polishResult = await runPolishLoopWithCallback(config, {
            onScore: (score) => setCurrentScore(score),
            onIteration: (i) => setIteration(i),
            onImproving: (metric) => setImproving(metric),
            onAgentText: (text) => setAgentText((prev) => prev + text),
            onAgentTool: (tool) => setAgentTool(tool),
            onAgentToolDone: () => setAgentTool(null),
            onCommit: () => {
              setAgentText('');
              setAgentTool(null);
            },
            onRollback: () => {
              setAgentText('');
              setAgentTool(null);
            },
          });

          setResult(polishResult);
        }

        setPhase('done');
      } catch (err) {
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
          <Box marginTop={1}>
            <AgentOutput text={agentText} currentTool={agentTool} />
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

          {agentTool && (
            <Box marginTop={1}>
              <AgentOutput text={agentText} currentTool={agentTool} />
            </Box>
          )}
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
