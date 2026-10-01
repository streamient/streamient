import { CommandRegistry } from './command-registry.js';

export class CommandReferenceRenderer {
	constructor(registry = new CommandRegistry()) {
		this.registry = registry;
	}

	render() {
		const rows = this.registry.allCommands().map((command) => {
			const positionals = command.positionals.map((name) => `<${name.replace(/_/g, '-')}>`).join(' ');
			const usage = `streamient-cli ${command.group} ${command.name}${positionals ? ` ${positionals}` : ''}`;
			return `| \`${command.group}\` | \`${command.name}\` | \`${command.tool}\` | \`${usage}\` | ${command.description} |`;
		});
		return `---
title: Streamient CLI Command Reference
description: "Reference all 44 Streamient CLI commands for notes, memories, knowledge, URLs, emails, projects, graph links, and Git sync."
---

# CLI Command Reference

This reference is generated from the Streamient CLI alias registry. The ${rows.length} friendly commands map one-to-one to the complete MCP tool catalog.

Run \`streamient-cli <group> <command> --help\` with \`STREAMIENT_CLI_ACCESS_TOKEN\` set to load the current options, required fields, types, and enum values directly from the connected MCP server.

| Group | Command | MCP tool | Usage | Description |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

Search commands default to five results per collection on updated servers. Use \`--per-page\` to override and \`--page\` where supported to paginate. Read relevant full records before deciding; see [Agent Configuration](../mcp/agents).

## Generic tool access

New MCP tools remain usable before a CLI alias release:

\`\`\`fish
streamient-cli tools list
streamient-cli tools describe search_knowledge
streamient-cli tools call search_knowledge --input '{"query":"release decision"}'
\`\`\`

See [Using the CLI](./using) for flags, JSON and file input, safety confirmation, output formats, and automation examples.
`;
	}
}
