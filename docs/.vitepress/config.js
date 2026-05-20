import { defineConfig } from 'vitepress';
import { useSidebar } from 'vitepress-openapi';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs';
import spec from './data/openapi.json' with { type: 'json' };

const sidebar = useSidebar({ spec, linkPrefix: '/api/operations/' });

export default defineConfig({
    title: 'Kumbukum Docs',
    description: 'Documentation for Kumbukum — Notes, Memory, URLs, AI Chat',
    base: '/docs/',
    cleanUrls: true,

    head: [
        ['link', { rel: 'icon', type: 'image/x-icon', href: '/docs/favicon.ico' }],
    ],

    markdown: {
        config(md) {
            md.use(tabsMarkdownPlugin);
        },
    },

    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/' },
            { text: 'Cloud', link: '/cloud/' },
            { text: 'Self-Hosted', link: '/selfhosted/' },
            {
                text: 'API Reference',
                items: [
                    { text: 'Overview', link: '/api/' },
                    { text: 'Authentication', link: '/api/authentication' },
                ],
            },
            { text: 'MCP', link: '/mcp/' },
            {
                text: process.env.VITEPRESS_VERSION || 'dev',
                items: [
                    { text: 'Changelog', link: 'https://github.com/kumbukum/kumbukum/releases' },
                ],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Introduction', link: '/guide/' },
                    ],
                },
                {
                    text: 'Guide',
                    items: [
                        { text: 'Projects', link: '/guide/projects' },
                        { text: 'Notes', link: '/guide/notes' },
                        { text: 'Memories', link: '/guide/memories' },
                        { text: 'URLs', link: '/guide/urls' },
                        { text: 'Knowledge Graph', link: '/guide/graph' },
                        { text: 'AI Chat', link: '/guide/ai-chat' },
                        { text: 'Import', link: '/guide/import' },
                        { text: 'Git Sync', link: '/guide/git-sync' },
                        { text: 'Settings', link: '/guide/settings' },
                    ],
                },
                {
                    text: 'Tools & Extensions',
                    items: [
                        { text: 'Browser Extension', link: '/guide/browser-extension' },
                    ],
                },
            ],
            '/cloud/': [
                {
                    text: 'Kumbukum Cloud',
                    items: [
                        { text: 'Overview', link: '/cloud/' },
                        { text: 'Account', link: '/cloud/account' },
                        { text: 'Billing', link: '/cloud/billing' },
                        { text: 'Support', link: '/cloud/support' },
                    ],
                },
            ],
            '/selfhosted/': [
                {
                    text: 'Self-Hosted',
                    items: [
                        { text: 'Overview', link: '/selfhosted/' },
                        { text: 'Installation', link: '/selfhosted/installation' },
                        { text: 'Configuration', link: '/selfhosted/configuration' },
                        { text: 'Upgrading', link: '/selfhosted/upgrading' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Overview', link: '/api/' },
                        { text: 'Authentication', link: '/api/authentication' },
                        { text: 'Notes', link: '/api/notes' },
                        { text: 'Memories', link: '/api/memories' },
                        { text: 'URLs', link: '/api/urls' },
                        { text: 'Search', link: '/api/search' },
                    ],
                },
                {
                    text: 'OpenAPI Reference',
                    collapsed: true,
                    items: sidebar.generateSidebarGroups().map(group => ({
                        ...group,
                        collapsed: true,
                    })),
                },
            ],
            '/mcp/': [
                {
                    text: 'MCP Server',
                    items: [
                        { text: 'Overview', link: '/mcp/' },
                        { text: 'Setup', link: '/mcp/setup' },
                        { text: 'Tools', link: '/mcp/tools' },
                        { text: 'Agent Configuration', link: '/mcp/agents' },
                        { text: 'Claude Code', link: '/mcp/claude-code' },
                        { text: 'Cursor (IDE)', link: '/mcp/cursor-ide' },
                    ],
                },
            ],
        },

        search: {
            provider: 'local',
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/kumbukum/kumbukum' },
        ],

        editLink: {
            pattern: 'https://github.com/kumbukum/kumbukum/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
    },
});
