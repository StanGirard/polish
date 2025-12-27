import React from 'react';
import { Box, Text } from 'ink';
import type { ScoreResult } from '../types.js';

interface ScoreDisplayProps {
  score: ScoreResult;
  target: number;
}

export function ScoreDisplay({ score, target }: ScoreDisplayProps) {
  const getScoreColor = (value: number): string => {
    if (value >= 95) return 'green';
    if (value >= 80) return 'yellow';
    return 'red';
  };

  const barWidth = 30;
  const filledWidth = Math.round((score.total / 100) * barWidth);
  const targetPos = Math.round((target / 100) * barWidth);

  const bar = Array(barWidth)
    .fill(null)
    .map((_, i) => {
      if (i === targetPos) return '│';
      if (i < filledWidth) return '█';
      return '░';
    })
    .join('');

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Score: </Text>
        <Text bold color={getScoreColor(score.total)}>
          {score.total.toFixed(1)}
        </Text>
        <Text color="dim">/{target}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={getScoreColor(score.total)}>[{bar}]</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {score.metrics.map((metric) => (
          <Box key={metric.name}>
            <Text color="dim">{metric.name.padEnd(12)}</Text>
            <Text color={getScoreColor(metric.score)}>{metric.score.toString().padStart(3)}%</Text>
            <Text color="dim"> / {metric.target}%</Text>
            <Text color="dim"> (weight: {metric.weight})</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface MiniScoreProps {
  score: number;
  label?: string;
}

export function MiniScore({ score, label }: MiniScoreProps) {
  const color = score >= 95 ? 'green' : score >= 80 ? 'yellow' : 'red';

  return (
    <Box>
      {label && <Text color="dim">{label}: </Text>}
      <Text bold color={color}>
        {score.toFixed(1)}
      </Text>
    </Box>
  );
}
