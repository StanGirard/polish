import type { AnyActivity } from '../types.js';
interface AgentOutputProps {
    activities: AnyActivity[];
    maxLines?: number;
}
export declare function AgentOutput({ activities, maxLines }: AgentOutputProps): import("react/jsx-runtime").JSX.Element;
export {};
