import type { ScoreResult } from '../types.js';
interface ScoreDisplayProps {
    score: ScoreResult;
    target: number;
}
export declare function ScoreDisplay({ score, target }: ScoreDisplayProps): import("react/jsx-runtime").JSX.Element;
interface MiniScoreProps {
    score: number;
    label?: string;
}
export declare function MiniScore({ score, label }: MiniScoreProps): import("react/jsx-runtime").JSX.Element;
export {};
