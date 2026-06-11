#!/usr/bin/env node
import { noteTools } from '../apps/mcp/tools/notes.js';
import { memoryTools } from '../apps/mcp/tools/memory.js';
import { urlTools } from '../apps/mcp/tools/urls.js';
import { emailTools } from '../apps/mcp/tools/emails.js';
import { projectTools } from '../apps/mcp/tools/projects.js';
import { graphTools } from '../apps/mcp/tools/graph.js';
import { gitSyncTools } from '../apps/mcp/tools/git_sync.js';
import { applyPublicAppToolProfile, MCP_TOOL_PROFILES } from '../apps/mcp/tools/profile.js';
import { MCP_SERVER_INSTRUCTIONS } from '../apps/mcp/instructions.js';

const DEFAULT_PROJECT_ID = 'benchmark-project';

function estimateTokens(value) {
    return Math.ceil(String(value || '').length / 4);
}

function estimateTokensFromChars(chars) {
    return Math.ceil(chars / 4);
}

function zodTypeName(schema) {
    if (!schema) return 'unknown';
    const def = schema._def || {};
    const typeName = def.typeName || def.type;
    if (typeName === 'optional' || typeName === 'ZodOptional') {
        return `${zodTypeName(def.innerType)}?`;
    }
    if (schema.constructor?.name) return schema.constructor.name.replace(/^Zod/, '').toLowerCase();
    return String(typeName || 'unknown');
}

function summarizeInputSchema(inputSchema = {}) {
    const summary = {};
    for (const [name, schema] of Object.entries(inputSchema)) {
        summary[name] = {
            type: zodTypeName(schema),
            description: schema?.description || '',
        };
    }
    return summary;
}

function buildTools(profile = MCP_TOOL_PROFILES.FULL) {
    const api = {};
    const tools = {
        ...noteTools(api, DEFAULT_PROJECT_ID),
        ...memoryTools(api, DEFAULT_PROJECT_ID),
        ...urlTools(api, DEFAULT_PROJECT_ID),
        ...emailTools(api, DEFAULT_PROJECT_ID),
        ...projectTools(api),
        ...graphTools(api),
        ...gitSyncTools(api, DEFAULT_PROJECT_ID),
    };
    if (profile === MCP_TOOL_PROFILES.APP) return applyPublicAppToolProfile(tools);
    return tools;
}

function buildMetadata(profile) {
    const tools = buildTools(profile);
    return Object.entries(tools)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: summarizeInputSchema(tool.inputSchema),
        }));
}

function sumToolChars(tools) {
    return tools.reduce((total, tool) => total + JSON.stringify(tool).length, 0);
}

const labelArgIndex = process.argv.indexOf('--label');
const label = labelArgIndex >= 0 ? process.argv[labelArgIndex + 1] : 'current';
const profileArgIndex = process.argv.indexOf('--profile');
const profile = profileArgIndex >= 0 ? process.argv[profileArgIndex + 1] : MCP_TOOL_PROFILES.FULL;
const tools = buildMetadata(profile);
const toolChars = sumToolChars(tools);
const instructionsChars = MCP_SERVER_INSTRUCTIONS.length;
const result = {
    label,
    profile,
    generated_at: new Date().toISOString(),
    token_estimator: 'ceil(chars / 4)',
    instructions: {
        chars: instructionsChars,
        estimated_tokens: estimateTokensFromChars(instructionsChars),
    },
    tools: {
        count: tools.length,
        chars: toolChars,
        estimated_tokens: estimateTokensFromChars(toolChars),
        names: tools.map((tool) => tool.name),
    },
    total: {
        chars: instructionsChars + toolChars,
        estimated_tokens: estimateTokensFromChars(instructionsChars + toolChars),
    },
};

console.log(JSON.stringify(result, null, 2));
