# Knowledge Graph

The Knowledge Graph is a visual map of how your knowledge connects. It draws lines between notes, memories, and URLs based on explicit links you create, shared tags, and semantic similarity.

## Purpose

As your library grows, individual items don't exist in isolation. A note about a project decision relates to the URL where you found the research, which connects to a memory about the team's preference. The graph makes these relationships visible and navigable.

Instead of searching for each item one at a time, the graph lets you explore your knowledge spatially — follow connections, spot clusters, and discover relationships you might not have noticed.

## Three Types of Connections

### Manual Links

Links you create yourself. Open any item (note, memory, or URL), scroll to the **Links** section, search for a related item, and click to connect them. These are the most intentional and permanent connections.

### Tag-Based Links

Computed automatically from shared tags. If a note and a memory both have the tag `architecture`, the graph draws a line between them. The more items share a tag, the denser that cluster becomes — giving you a visual sense of your most documented topics.

### Semantic Links

Discovered through vector similarity. Streamient uses Typesense embeddings to find items that are about similar topics even if they don't share tags or explicit links. These connections surface relationships based on meaning, not just keywords.

Semantic links are calculated on demand and cached for performance.

## Using the Graph

Navigate to the **Graph** page from the main navigation. The graph renders all your items as nodes, color-coded by type:

- **Notes** — one color
- **Memories** — another color
- **URLs** — a third color

Edges between nodes are drawn based on the three connection types above.

### Filtering

- **By project** — Use the project sidebar to scope the graph to a single project
- **By connection type** — Toggle tag-based and semantic edges on or off to focus on the connections that matter most

### Interaction

- Click a node to view the item details
- Zoom and pan to explore different areas of your graph
- Nodes are laid out automatically using a force-directed algorithm that groups related items together

## Building a Useful Graph

The graph becomes more useful as you:

- **Tag consistently** — Reuse tags across item types so tag-based edges form naturally
- **Link intentionally** — When you notice a connection between items, add a manual link
- **Write descriptively** — Clear titles and content improve semantic similarity detection

## API & MCP

Links can also be created and deleted through the [REST API](/api/) and [MCP tools](/mcp/tools). AI assistants can build your graph as they work — creating links between the items they create or discover.
