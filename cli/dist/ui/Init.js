import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import { initPolish } from '../settings.js';
export function Init({ onComplete, onCancel }) {
    const { exit } = useApp();
    const { isRawModeSupported } = useStdin();
    const [step, setStep] = useState('confirm');
    const [provider, setProvider] = useState('anthropic');
    const [apiKey, setApiKey] = useState('');
    const [selectedOption, setSelectedOption] = useState(0);
    // Handle non-interactive mode
    useEffect(() => {
        if (!isRawModeSupported) {
            // Can't do interactive setup, exit with instructions
            console.error('\nInteractive mode not available.');
            console.error('Use: polish --init --api-key YOUR_KEY [--provider anthropic|openrouter|openai]\n');
            onCancel();
            exit();
        }
    }, [isRawModeSupported, onCancel, exit]);
    const providerOptions = ['anthropic', 'openrouter', 'openai'];
    useInput((input, key) => {
        if (step === 'confirm') {
            if (key.upArrow || key.downArrow) {
                setSelectedOption((prev) => (prev === 0 ? 1 : 0));
            }
            else if (key.return) {
                if (selectedOption === 0) {
                    setStep('provider');
                    setSelectedOption(0);
                }
                else {
                    onCancel();
                    exit();
                }
            }
        }
        else if (step === 'provider') {
            if (key.upArrow) {
                setSelectedOption((prev) => (prev === 0 ? providerOptions.length - 1 : prev - 1));
            }
            else if (key.downArrow) {
                setSelectedOption((prev) => (prev === providerOptions.length - 1 ? 0 : prev + 1));
            }
            else if (key.return) {
                setProvider(providerOptions[selectedOption]);
                setStep('apikey');
            }
        }
        else if (step === 'apikey') {
            if (key.return && apiKey.length > 0) {
                const settings = {
                    defaultProvider: provider,
                    [provider]: { apiKey },
                };
                initPolish(settings);
                setStep('done');
                setTimeout(onComplete, 500);
            }
            else if (key.backspace || key.delete) {
                setApiKey((prev) => prev.slice(0, -1));
            }
            else if (input && !key.ctrl && !key.meta) {
                setApiKey((prev) => prev + input);
            }
        }
    }, { isActive: isRawModeSupported });
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "green", children: "Polish CLI - Setup" }), _jsx(Text, { color: "dim", children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), step === 'confirm' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { children: "Polish is not initialized in this folder." }), _jsx(Text, { children: "Initialize polish here?" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: selectedOption === 0 ? 'green' : 'dim', children: [selectedOption === 0 ? '❯ ' : '  ', "Yes, initialize"] }), _jsxs(Text, { color: selectedOption === 1 ? 'red' : 'dim', children: [selectedOption === 1 ? '❯ ' : '  ', "No, cancel"] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "dim", children: "(Use arrows to select, Enter to confirm)" }) })] })), step === 'provider' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { children: "Select your AI provider:" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: selectedOption === 0 ? 'cyan' : 'dim', children: [selectedOption === 0 ? '❯ ' : '  ', "Anthropic (Claude API)"] }), _jsxs(Text, { color: selectedOption === 1 ? 'cyan' : 'dim', children: [selectedOption === 1 ? '❯ ' : '  ', "OpenRouter"] }), _jsxs(Text, { color: selectedOption === 2 ? 'cyan' : 'dim', children: [selectedOption === 2 ? '❯ ' : '  ', "OpenAI (GPT API)"] })] })] })), step === 'apikey' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { children: ["Enter your ", provider === 'anthropic' ? 'Anthropic' : provider === 'openrouter' ? 'OpenRouter' : 'OpenAI', " API key:"] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: apiKey.length > 0 ? '•'.repeat(apiKey.length) : '(paste your key)' }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "dim", children: "(Press Enter when done)" }) })] })), step === 'done' && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "green", children: "\u2713 Polish initialized!" }), _jsx(Text, { color: "dim", children: "Settings saved to .polish/settings.json" })] }))] }));
}
