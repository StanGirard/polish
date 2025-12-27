import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
export function AgentOutput({ text, currentTool }) {
    // Get last few lines of text
    const lines = text.split('\n').filter(Boolean);
    const lastLines = lines.slice(-5);
    return (_jsxs(Box, { flexDirection: "column", children: [currentTool && (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: _jsx(Spinner, { type: "dots" }) }), _jsxs(Text, { color: "cyan", children: [" ", currentTool] })] })), lastLines.length > 0 && (_jsx(Box, { flexDirection: "column", marginTop: currentTool ? 1 : 0, children: lastLines.map((line, i) => (_jsxs(Text, { color: "dim", wrap: "truncate", children: [line.slice(0, 80), line.length > 80 ? '...' : ''] }, i))) }))] }));
}
