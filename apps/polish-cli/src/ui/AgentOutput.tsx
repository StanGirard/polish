import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AnyActivity, ToolActivity, TextActivity, StatusActivity } from '../types.js';

interface AgentOutputProps {
  activities: AnyActivity[];
  maxLines?: number; // Show last N activities, default: show all
}

export function AgentOutput({ activities, maxLines }: AgentOutputProps) {
  const items = maxLines ? activities.slice(-maxLines) : activities;

  if (items.length === 0) {
    return (
      <Box>
        <Text color="dim">Waiting for agent...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </Box>
  );
}

function ActivityRow({ item }: { item: AnyActivity }) {
  switch (item.type) {
    case 'text':
      return <TextRow item={item} />;
    case 'tool':
      return <ToolRow item={item} />;
    case 'status':
      return <StatusRow item={item} />;
    default:
      return null;
  }
}

function TextRow({ item }: { item: TextActivity }) {
  // Split text into lines and render each
  const lines = item.content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color="white" wrap="wrap">
          {line}
        </Text>
      ))}
    </Box>
  );
}

function ToolRow({ item }: { item: ToolActivity }) {
  const icon = getToolIcon(item.name);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{icon} </Text>
        <Text color="cyan">{item.displayText}</Text>
        <Text> </Text>
        <StatusIndicator status={item.status} />
        {item.duration !== undefined && (
          <Text color="dim"> {formatDuration(item.duration)}</Text>
        )}
      </Box>
      {item.status === 'error' && item.error && (
        <Box marginLeft={3}>
          <Text color="red">{item.error}</Text>
        </Box>
      )}
    </Box>
  );
}

function StatusRow({ item }: { item: StatusActivity }) {
  const colorMap: Record<StatusActivity['variant'], string> = {
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  };

  const iconMap: Record<StatusActivity['variant'], string> = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  return (
    <Box>
      <Text color={colorMap[item.variant]}>{iconMap[item.variant]} </Text>
      <Text color={colorMap[item.variant]}>{item.message}</Text>
    </Box>
  );
}

function StatusIndicator({ status }: { status: ToolActivity['status'] }) {
  switch (status) {
    case 'running':
      return (
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
      );
    case 'done':
      return <Text color="green">✓</Text>;
    case 'error':
      return <Text color="red">✗</Text>;
    default:
      return null;
  }
}

function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    read_file: '📄',
    write_file: '✏️',
    edit_file: '📝',
    bash: '💻',
    glob: '🔍',
    grep: '🔎',
    list_dir: '📁',
  };
  return icons[name] || '🔧';
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
