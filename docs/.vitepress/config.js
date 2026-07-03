import { defineConfig } from 'vitepress';
import { useSidebar } from 'vitepress-openapi';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs';
import spec from './data/openapi.json' with { type: 'json' };

const sidebar = useSidebar({ spec, linkPrefix: '/api/operations/' });

// Base is build-time configurable: '/docs/' for app.kumbukum.com/docs/, and '/'
// for the vanity domain build served at docs.kumbukum.com (KUMBUKUM_DOCS_BASE=/).
const docsBase = process.env.KUMBUKUM_DOCS_BASE || '/docs/';

export default defineConfig({
    title: 'Kumbukum Docs',
    description: 'Documentation for Kumbukum — Notes, Memory, URLs, AI Chat',
    base: docsBase,
    cleanUrls: true,

    head: [
        ['link', { rel: 'icon', type: 'image/x-icon', href: `${docsBase}favicon.ico` }],
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
            { text: 'MCP', link: '/mcp/' },
            { text: 'API', link: '/api/' },
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
                    text: 'Email',
                    items: [
                        { text: 'Overview', link: '/guide/email/' },
                        { text: 'Parsing', link: '/guide/email/parsing' },
                        { text: 'Forwarding', link: '/guide/email/forwarding' },
                    ],
                },
                {
                    text: 'Browser Extension',
                    items: [
                        { text: 'Overview', link: '/guide/browser-extension/' },
                        { text: 'Setup', link: '/guide/browser-extension/setup' },
                        { text: 'URL Capture', link: '/guide/browser-extension/url-capture' },
                        { text: 'Email Capture', link: '/guide/browser-extension/email-capture' },
                        { text: 'Multiple Accounts', link: '/guide/browser-extension/multiple-accounts' },
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
                        { text: 'Emails', link: '/api/emails' },
                        { text: 'Search', link: '/api/search' },
                    ],
                },
                {
                    text: 'OpenAPI',
                    items: sidebar.generateSidebarGroups()
                        .slice()
                        .sort((a, b) => a.text.localeCompare(b.text))
                        // collapsed: true → collapsed by default but expandable
                        .map(group => ({ ...group, collapsed: true })),
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
