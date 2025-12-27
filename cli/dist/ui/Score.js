import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function ScoreDisplay({ score, target }) {
    const getScoreColor = (value) => {
        if (value >= 95)
            return 'green';
        if (value >= 80)
            return 'yellow';
        return 'red';
    };
    const barWidth = 30;
    const filledWidth = Math.round((score.total / 100) * barWidth);
    const targetPos = Math.round((target / 100) * barWidth);
    const bar = Array(barWidth)
        .fill(null)
        .map((_, i) => {
        if (i === targetPos)
            return '│';
        if (i < filledWidth)
            return '█';
        return '░';
    })
        .join('');
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { children: "Score: " }), _jsx(Text, { bold: true, color: getScoreColor(score.total), children: score.total.toFixed(1) }), _jsxs(Text, { color: "dim", children: ["/", target] })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: getScoreColor(score.total), children: ["[", bar, "]"] }) }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: score.metrics.map((metric) => (_jsxs(Box, { children: [_jsx(Text, { color: "dim", children: metric.name.padEnd(12) }), _jsxs(Text, { color: getScoreColor(metric.score), children: [metric.score.toString().padStart(3), "%"] }), _jsxs(Text, { color: "dim", children: [" / ", metric.target, "%"] }), _jsxs(Text, { color: "dim", children: [" (weight: ", metric.weight, ")"] })] }, metric.name))) })] }));
}
export function MiniScore({ score, label }) {
    const color = score >= 95 ? 'green' : score >= 80 ? 'yellow' : 'red';
    return (_jsxs(Box, { children: [label && _jsxs(Text, { color: "dim", children: [label, ": "] }), _jsx(Text, { bold: true, color: color, children: score.toFixed(1) })] }));
}
