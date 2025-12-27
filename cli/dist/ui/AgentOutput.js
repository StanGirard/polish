import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
export function AgentOutput({ activities, maxLines }) {
    const items = maxLines ? activities.slice(-maxLines) : activities;
    if (items.length === 0) {
        return (_jsx(Box, { children: _jsx(Text, { color: "dim", children: "Waiting for agent..." }) }));
    }
    return (_jsx(Box, { flexDirection: "column", children: items.map((item) => (_jsx(ActivityRow, { item: item }, item.id))) }));
}
function ActivityRow({ item }) {
    switch (item.type) {
        case 'text':
            return _jsx(TextRow, { item: item });
        case 'tool':
            return _jsx(ToolRow, { item: item });
        case 'status':
            return _jsx(StatusRow, { item: item });
        default:
            return null;
    }
}
function TextRow({ item }) {
    // Split text into lines and render each
    const lines = item.content.split('\n');
    return (_jsx(Box, { flexDirection: "column", children: lines.map((line, i) => (_jsx(Text, { color: "white", wrap: "wrap", children: line }, i))) }));
}
function ToolRow({ item }) {
    const icon = getToolIcon(item.name);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [icon, " "] }), _jsx(Text, { color: "cyan", children: item.displayText }), _jsx(Text, { children: " " }), _jsx(StatusIndicator, { status: item.status }), item.duration !== undefined && (_jsxs(Text, { color: "dim", children: [" ", formatDuration(item.duration)] }))] }), item.status === 'error' && item.error && (_jsx(Box, { marginLeft: 3, children: _jsx(Text, { color: "red", children: item.error }) }))] }));
}
function StatusRow({ item }) {
    const colorMap = {
        info: 'blue',
        success: 'green',
        warning: 'yellow',
        error: 'red',
    };
    const iconMap = {
        info: 'ℹ',
        success: '✓',
        warning: '⚠',
        error: '✗',
    };
    return (_jsxs(Box, { children: [_jsxs(Text, { color: colorMap[item.variant], children: [iconMap[item.variant], " "] }), _jsx(Text, { color: colorMap[item.variant], children: item.message })] }));
}
function StatusIndicator({ status }) {
    switch (status) {
        case 'running':
            return (_jsx(Text, { color: "yellow", children: _jsx(Spinner, { type: "dots" }) }));
        case 'done':
            return _jsx(Text, { color: "green", children: "\u2713" });
        case 'error':
            return _jsx(Text, { color: "red", children: "\u2717" });
        default:
            return null;
    }
}
function getToolIcon(name) {
    const icons = {
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
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
}
