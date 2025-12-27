import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import { initPolish, type Settings } from '../settings.js';
import type { ProviderType } from '../types.js';

type Step = 'confirm' | 'provider' | 'apikey' | 'done';

interface InitProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function Init({ onComplete, onCancel }: InitProps) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [step, setStep] = useState<Step>('confirm');
  const [provider, setProvider] = useState<ProviderType>('anthropic');
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

  const providerOptions: ProviderType[] = ['anthropic', 'openrouter', 'openai'];

  useInput((input, key) => {
    if (step === 'confirm') {
      if (key.upArrow || key.downArrow) {
        setSelectedOption((prev) => (prev === 0 ? 1 : 0));
      } else if (key.return) {
        if (selectedOption === 0) {
          setStep('provider');
          setSelectedOption(0);
        } else {
          onCancel();
          exit();
        }
      }
    } else if (step === 'provider') {
      if (key.upArrow) {
        setSelectedOption((prev) => (prev === 0 ? providerOptions.length - 1 : prev - 1));
      } else if (key.downArrow) {
        setSelectedOption((prev) => (prev === providerOptions.length - 1 ? 0 : prev + 1));
      } else if (key.return) {
        setProvider(providerOptions[selectedOption]);
        setStep('apikey');
      }
    } else if (step === 'apikey') {
      if (key.return && apiKey.length > 0) {
        const settings: Settings = {
          defaultProvider: provider,
          [provider]: { apiKey },
        };
        initPolish(settings);
        setStep('done');
        setTimeout(onComplete, 500);
      } else if (key.backspace || key.delete) {
        setApiKey((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setApiKey((prev) => prev + input);
      }
    }
  }, { isActive: isRawModeSupported });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Polish CLI - Setup
      </Text>
      <Text color="dim">─────────────────────────────</Text>

      {step === 'confirm' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Polish is not initialized in this folder.</Text>
          <Text>Initialize polish here?</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={selectedOption === 0 ? 'green' : 'dim'}>
              {selectedOption === 0 ? '❯ ' : '  '}Yes, initialize
            </Text>
            <Text color={selectedOption === 1 ? 'red' : 'dim'}>
              {selectedOption === 1 ? '❯ ' : '  '}No, cancel
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="dim">(Use arrows to select, Enter to confirm)</Text>
          </Box>
        </Box>
      )}

      {step === 'provider' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select your AI provider:</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color={selectedOption === 0 ? 'cyan' : 'dim'}>
              {selectedOption === 0 ? '❯ ' : '  '}Anthropic (Claude API)
            </Text>
            <Text color={selectedOption === 1 ? 'cyan' : 'dim'}>
              {selectedOption === 1 ? '❯ ' : '  '}OpenRouter
            </Text>
            <Text color={selectedOption === 2 ? 'cyan' : 'dim'}>
              {selectedOption === 2 ? '❯ ' : '  '}OpenAI (GPT API)
            </Text>
          </Box>
        </Box>
      )}

      {step === 'apikey' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Enter your {provider === 'anthropic' ? 'Anthropic' : provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'} API key:
          </Text>
          <Box marginTop={1}>
            <Text color="cyan">
              {apiKey.length > 0 ? '•'.repeat(apiKey.length) : '(paste your key)'}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="dim">(Press Enter when done)</Text>
          </Box>
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">✓ Polish initialized!</Text>
          <Text color="dim">Settings saved to .polish/settings.json</Text>
        </Box>
      )}
    </Box>
  );
}
