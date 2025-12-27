import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface AgentOutputProps {
  text: string;
  currentTool: string | null;
}

export function AgentOutput({ text, currentTool }: AgentOutputProps) {
  // Get last few lines of text
  const lines = text.split('\n').filter(Boolean);
  const lastLines = lines.slice(-5);

  return (
    <Box flexDirection="column">
      {currentTool && (
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan"> {currentTool}</Text>
        </Box>
      )}

      {lastLines.length > 0 && (
        <Box flexDirection="column" marginTop={currentTool ? 1 : 0}>
          {lastLines.map((line, i) => (
            <Text key={i} color="dim" wrap="truncate">
              {line.slice(0, 80)}{line.length > 80 ? '...' : ''}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
