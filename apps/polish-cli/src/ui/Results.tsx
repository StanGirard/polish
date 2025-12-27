import React from 'react';
import { Box, Text } from 'ink';
import type { PolishResult } from '../types.js';

interface ResultsProps {
  result: PolishResult;
}

export function Results({ result }: ResultsProps) {
  const improvement = result.finalScore.total - result.initialScore.total;
  const improvementColor = improvement >= 0 ? 'green' : 'red';
  const improvementSign = improvement >= 0 ? '+' : '';

  const reasonText: Record<string, string> = {
    target_reached: 'Target reached!',
    plateau: 'Plateau (no more improvements possible)',
    max_iterations: 'Max iterations reached',
    error: 'Error occurred',
  };

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {'═'.repeat(40)}
      </Text>
      <Text bold color="green">
        Results
      </Text>
      <Text bold color="green">
        {'═'.repeat(40)}
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="dim">{'Initial score:'.padEnd(16)}</Text>
          <Text>{result.initialScore.total.toFixed(1)}</Text>
        </Box>
        <Box>
          <Text color="dim">{'Final score:'.padEnd(16)}</Text>
          <Text bold color={improvementColor}>
            {result.finalScore.total.toFixed(1)}
          </Text>
        </Box>
        <Box>
          <Text color="dim">{'Improvement:'.padEnd(16)}</Text>
          <Text color={improvementColor}>
            {improvementSign}
            {improvement.toFixed(1)}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="dim">{'Iterations:'.padEnd(16)}</Text>
          <Text>{result.iterations}</Text>
        </Box>
        <Box>
          <Text color="dim">{'Commits:'.padEnd(16)}</Text>
          <Text>{result.commits.length}</Text>
        </Box>
        <Box>
          <Text color="dim">{'Status:'.padEnd(16)}</Text>
          <Text
            color={result.reason === 'target_reached' ? 'green' : 'yellow'}
          >
            {reasonText[result.reason] || result.reason}
          </Text>
        </Box>
      </Box>

      {result.commits.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="dim">Commits:</Text>
          {result.commits.map((hash, i) => (
            <Text key={i} color="cyan">
              {'  '}{hash}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold color="green">
          Done!
        </Text>
      </Box>
    </Box>
  );
}
