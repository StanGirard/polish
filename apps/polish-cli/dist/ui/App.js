import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
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
import { isGitRepo, getCurrentBranch, createWorktree, removeWorktree, createBranchFromWorktree, generatePolishBranchName, } from '../git.js';
import { isInitialized } from '../settings.js';
export function App({ mission, options }) {
    const { exit } = useApp();
    const [phase, setPhase] = useState('check-init');
    const [branch, setBranch] = useState('');
    const [error, setError] = useState(null);
    // Activity log for streaming output
    const [activities, setActivities] = useState([]);
    // Helper functions for activity management
    const addTextActivity = (content) => {
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
    const addToolActivity = (id, name, displayText) => {
        setActivities((prev) => [
            ...prev,
            {
                id,
                type: 'tool',
                name,
                displayText,
                status: 'running',
                timestamp: Date.now(),
            },
        ]);
    };
    const updateToolActivity = (id, success, output, error, duration) => {
        setActivities((prev) => prev.map((a) => a.id === id && a.type === 'tool'
            ? {
                ...a,
                status: success ? 'done' : 'error',
                result: output,
                error,
                duration,
            }
            : a));
    };
    const addStatusActivity = (message, variant) => {
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
    const [currentScore, setCurrentScore] = useState(null);
    const [iteration, setIteration] = useState(0);
    const [maxIterations, setMaxIterations] = useState(50);
    const [improving, setImproving] = useState(null);
    const [result, setResult] = useState(null);
    // Worktree state for cleanup on exit
    const [worktreeInfo, setWorktreeInfo] = useState(null);
    // Check initialization on mount
    useEffect(() => {
        if (phase === 'check-init') {
            if (isInitialized()) {
                setPhase('running');
            }
            else {
                setPhase('init');
            }
        }
    }, [phase]);
    // Cleanup worktree on SIGINT/SIGTERM
    useEffect(() => {
        const cleanup = () => {
            if (worktreeInfo) {
                removeWorktree(worktreeInfo.path).catch(() => { });
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
        if (phase !== 'running')
            return;
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
                    let polishResult;
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
                    }
                    finally {
                        // Always clean up worktree
                        await removeWorktree(worktree.path);
                        setWorktreeInfo(null);
                    }
                    setResult(polishResult);
                }
                setPhase('done');
            }
            catch (err) {
                // Clean up worktree on error
                if (worktreeInfo) {
                    await removeWorktree(worktreeInfo.path).catch(() => { });
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
        return (_jsx(Init, { onComplete: () => setPhase('running'), onCancel: () => exit() }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Header, { branch: branch }), (phase === 'check-init' || phase === 'running') && (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { children: " Initializing..." })] })), phase === 'implement' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, color: "blue", children: '─'.repeat(40) }), _jsx(Text, { bold: true, color: "blue", children: "Implementation" }), _jsx(Text, { color: "dim", children: mission }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(AgentOutput, { activities: activities }) })] })), phase === 'polish' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: '─'.repeat(40) }), _jsx(Text, { bold: true, color: "yellow", children: "Polish Loop" }), currentScore && (_jsx(Box, { marginTop: 1, children: _jsx(ScoreDisplay, { score: currentScore, target: parseInt(options.target, 10) }) })), _jsx(PolishProgress, { iteration: iteration, maxIterations: maxIterations, improving: improving }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(AgentOutput, { activities: activities }) })] })), phase === 'done' && result && (_jsx(Box, { marginTop: 1, children: _jsx(Results, { result: result }) })), phase === 'error' && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "red", children: ["Error: ", error] }) }))] }));
}
