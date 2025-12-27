import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface PolishProgressProps {
  iteration: number;
  maxIterations: number;
  improving: string | null;
}

export function PolishProgress({ iteration, maxIterations, improving }: PolishProgressProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="dim">Iteration: </Text>
        <Text bold>{iteration}</Text>
        <Text color="dim">/{maxIterations}</Text>
      </Box>

      {improving && (
        <Box marginTop={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow"> Improving: </Text>
          <Text bold color="yellow">
            {improving}
          </Text>
        </Box>
      )}
    </Box>
  );
}
