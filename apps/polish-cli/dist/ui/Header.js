import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Header({ branch }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "green", children: '╔════════════════════════════════════════╗' }), _jsxs(Text, { bold: true, color: "green", children: ['║', _jsx(Text, { color: "white", children: " Polish CLI " }), _jsx(Text, { color: "dim", children: "- AI Code Improvement" }), '    ║'] }), _jsx(Text, { bold: true, color: "green", children: '╚════════════════════════════════════════╝' }), branch && (_jsxs(Text, { color: "dim", children: ["Branch: ", branch, " | ", process.cwd()] }))] }));
}
