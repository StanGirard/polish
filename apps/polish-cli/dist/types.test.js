import { describe, test, expect } from 'bun:test';
describe('types', () => {
    test('Metric type can be constructed', () => {
        const metric = {
            name: 'tests',
            command: 'bun test',
            weight: 100,
            target: 95,
            higherIsBetter: true,
        };
        expect(metric.name).toBe('tests');
        expect(metric.command).toBe('bun test');
        expect(metric.weight).toBe(100);
        expect(metric.target).toBe(95);
        expect(metric.higherIsBetter).toBe(true);
    });
    test('Metric type with optional higherIsBetter', () => {
        const metric = {
            name: 'lint',
            command: 'eslint .',
            weight: 50,
            target: 100,
        };
        expect(metric.higherIsBetter).toBeUndefined();
    });
    test('MetricResult type can be constructed', () => {
        const result = {
            name: 'tests',
            score: 85,
            target: 100,
            weight: 100,
            raw: '10 pass, 2 fail',
        };
        expect(result.name).toBe('tests');
        expect(result.score).toBe(85);
        expect(result.raw).toBe('10 pass, 2 fail');
    });
    test('ScoreResult type can be constructed', () => {
        const scoreResult = {
            total: 90.5,
            metrics: [
                { name: 'tests', score: 100, target: 100, weight: 100 },
                { name: 'lint', score: 80, target: 100, weight: 50 },
            ],
        };
        expect(scoreResult.total).toBe(90.5);
        expect(scoreResult.metrics).toHaveLength(2);
    });
    test('ProviderType accepts valid values', () => {
        const providers = ['anthropic', 'openrouter', 'openai'];
        expect(providers).toContain('anthropic');
        expect(providers).toContain('openrouter');
        expect(providers).toContain('openai');
    });
    test('Provider type can be constructed with all fields', () => {
        const provider = {
            type: 'anthropic',
            apiKey: 'sk-test-key',
            model: 'claude-sonnet-4.5',
            baseUrl: 'https://api.anthropic.com',
        };
        expect(provider.type).toBe('anthropic');
        expect(provider.apiKey).toBe('sk-test-key');
        expect(provider.model).toBe('claude-sonnet-4.5');
        expect(provider.baseUrl).toBe('https://api.anthropic.com');
    });
    test('Provider type with optional fields', () => {
        const provider = {
            type: 'openai',
        };
        expect(provider.type).toBe('openai');
        expect(provider.apiKey).toBeUndefined();
        expect(provider.model).toBeUndefined();
        expect(provider.baseUrl).toBeUndefined();
    });
    test('PolishConfig type can be constructed', () => {
        const config = {
            metrics: [{ name: 'tests', command: 'bun test', weight: 100, target: 95 }],
            target: 95,
            maxIterations: 50,
            provider: { type: 'anthropic' },
        };
        expect(config.metrics).toHaveLength(1);
        expect(config.target).toBe(95);
        expect(config.maxIterations).toBe(50);
        expect(config.provider?.type).toBe('anthropic');
    });
    test('ToolName accepts all valid tool names', () => {
        const tools = ['read_file', 'write_file', 'edit_file', 'bash', 'glob', 'grep', 'list_dir'];
        expect(tools).toHaveLength(7);
        expect(tools).toContain('read_file');
        expect(tools).toContain('write_file');
        expect(tools).toContain('edit_file');
        expect(tools).toContain('bash');
        expect(tools).toContain('glob');
        expect(tools).toContain('grep');
        expect(tools).toContain('list_dir');
    });
    test('ToolResult type with success', () => {
        const result = {
            success: true,
            output: 'Command completed successfully',
        };
        expect(result.success).toBe(true);
        expect(result.output).toBe('Command completed successfully');
        expect(result.error).toBeUndefined();
    });
    test('ToolResult type with error', () => {
        const result = {
            success: false,
            error: 'File not found',
        };
        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
        expect(result.output).toBeUndefined();
    });
});
