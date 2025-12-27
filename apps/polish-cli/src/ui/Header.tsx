import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  branch: string;
}

export function Header({ branch }: HeaderProps) {
  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {'╔════════════════════════════════════════╗'}
      </Text>
      <Text bold color="green">
        {'║'}
        <Text color="white"> Polish CLI </Text>
        <Text color="dim">- AI Code Improvement</Text>
        {'    ║'}
      </Text>
      <Text bold color="green">
        {'╚════════════════════════════════════════╝'}
      </Text>
      {branch && (
        <Text color="dim">
          Branch: {branch} | {process.cwd()}
        </Text>
      )}
    </Box>
  );
}
