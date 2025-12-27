import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Results({ result }) {
    const improvement = result.finalScore.total - result.initialScore.total;
    const improvementColor = improvement >= 0 ? 'green' : 'red';
    const improvementSign = improvement >= 0 ? '+' : '';
    const reasonText = {
        target_reached: 'Target reached!',
        plateau: 'Plateau (no more improvements possible)',
        max_iterations: 'Max iterations reached',
        error: 'Error occurred',
    };
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "green", children: '═'.repeat(40) }), _jsx(Text, { bold: true, color: "green", children: "Results" }), _jsx(Text, { bold: true, color: "green", children: '═'.repeat(40) }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Initial score:'.padEnd(16) }), _jsx(Text, { children: result.initialScore.total.toFixed(1) })] }), _jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Final score:'.padEnd(16) }), _jsx(Text, { bold: true, color: improvementColor, children: result.finalScore.total.toFixed(1) })] }), _jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Improvement:'.padEnd(16) }), _jsxs(Text, { color: improvementColor, children: [improvementSign, improvement.toFixed(1)] })] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Iterations:'.padEnd(16) }), _jsx(Text, { children: result.iterations })] }), _jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Commits:'.padEnd(16) }), _jsx(Text, { children: result.commits.length })] }), _jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Status:'.padEnd(16) }), _jsx(Text, { color: result.reason === 'target_reached' ? 'green' : 'yellow', children: reasonText[result.reason] || result.reason })] })] }), result.commits.length > 0 && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { color: "dim", children: "Commits:" }), result.commits.map((hash, i) => (_jsxs(Text, { color: "cyan", children: ['  ', hash] }, i)))] })), result.branchName && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "dim", children: 'Branch:'.padEnd(16) }), _jsx(Text, { bold: true, color: "magenta", children: result.branchName })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "dim", children: "To merge: " }), _jsxs(Text, { color: "cyan", children: ["git merge ", result.branchName] })] })] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { bold: true, color: "green", children: "Done!" }) })] }));
}
