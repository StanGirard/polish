import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
export function PolishProgress({ iteration, maxIterations, improving }) {
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "dim", children: "Iteration: " }), _jsx(Text, { bold: true, children: iteration }), _jsxs(Text, { color: "dim", children: ["/", maxIterations] })] }), improving && (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "yellow", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { color: "yellow", children: " Improving: " }), _jsx(Text, { bold: true, color: "yellow", children: improving })] }))] }));
}
