const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Streamient API',
        version: '1.0.0',
        description: 'Everything your AI needs to remember — Notes, Memory, URLs, AI Chat',
    },
    servers: [
        { url: '/api/v1', description: 'API v1' },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT token from login',
            },
            AccessToken: {
                type: 'apiKey',
                in: 'header',
                name: 'Authorization',
                description: 'Personal access token. Value: `Token <your-token>`',
            },
			AdminSession: {
				type: 'apiKey',
				in: 'cookie',
				name: 'connect.sid',
				description: 'Authenticated backend-admin session cookie.',
			},
        },
        schemas: {
            Project: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    color: { type: 'string' },
                    email_filter: {
                        type: 'string',
                        description: 'Incoming email trash filter rules. Supports sender address/domain/local-part rules and subject rules like `subject: failed login` or `subject contains: status update`.',
                    },
                    host_id: { type: 'string' },
                },
            },
            AccountTenant: {
                type: 'object',
                properties: {
                    tenantId: { type: 'string' },
                    host_id: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['owner', 'admin', 'member'] },
                    membershipId: { type: 'string' },
                    is_primary: { type: 'boolean' },
                },
            },
			TenantLimits: {
				type: 'object',
				description: 'Tenant-wide hosted limits. Zero means unlimited.',
				properties: {
					limit_projects: { type: 'integer', minimum: 0 },
					limit_users: { type: 'integer', minimum: 0 },
					limit_ai_workflows_per_day: { type: 'integer', minimum: 0 },
				},
				required: ['limit_projects', 'limit_users', 'limit_ai_workflows_per_day'],
			},
			AdminAccountOwner: {
				type: 'object',
				properties: {
					_id: { type: 'string' },
					name: { type: 'string' },
					email: { type: 'string', format: 'email' },
					is_active: { type: 'boolean' },
					last_login: { type: 'string', format: 'date-time', nullable: true },
					createdAt: { type: 'string', format: 'date-time', nullable: true },
				},
			},
			AdminAccountMember: {
				type: 'object',
				properties: {
					_id: { type: 'string', nullable: true },
					role: { type: 'string', enum: ['owner', 'admin', 'member'] },
					joined_at: { type: 'string', format: 'date-time', nullable: true },
					user: { $ref: '#/components/schemas/AdminAccountOwner' },
				},
			},
			AdminAccount: {
				allOf: [
					{ $ref: '#/components/schemas/TenantLimits' },
					{
						type: 'object',
						properties: {
							_id: { type: 'string', description: 'Tenant ID' },
							host_id: { type: 'string' },
							name: { type: 'string' },
							is_active: { type: 'boolean' },
							plan: { type: 'string', enum: ['free', 'pro'] },
							owner: { $ref: '#/components/schemas/AdminAccountOwner' },
							members: { type: 'array', items: { $ref: '#/components/schemas/AdminAccountMember' } },
							memberCount: { type: 'integer', minimum: 0 },
							projectCount: { type: 'integer', minimum: 0 },
							itemCount: { type: 'integer', minimum: 0 },
							createdAt: { type: 'string', format: 'date-time', nullable: true },
							updatedAt: { type: 'string', format: 'date-time', nullable: true },
						},
						required: ['_id', 'host_id', 'name', 'is_active', 'plan'],
					},
				],
			},
			AdminAccountWrite: {
				allOf: [
					{ $ref: '#/components/schemas/TenantLimits' },
					{
						type: 'object',
						properties: {
							name: { type: 'string', minLength: 1 },
							owner_name: { type: 'string', minLength: 1 },
							owner_email: { type: 'string', format: 'email' },
							plan: { type: 'string', enum: ['free', 'pro'] },
							is_active: { type: 'boolean' },
						},
						required: ['name', 'owner_name', 'owner_email', 'plan'],
					},
				],
			},
			AdminManaganiSettings: {
				type: 'object',
				properties: {
					enabled: { type: 'boolean' },
					base_url: { type: 'string' },
					site_key: { type: 'string' },
					site_secret_configured: { type: 'boolean' },
					site_secret_masked: { type: 'string', enum: ['', '********'] },
				},
				required: ['enabled', 'base_url', 'site_key', 'site_secret_configured', 'site_secret_masked'],
			},
			AdminManaganiSettingsWrite: {
				type: 'object',
				properties: {
					enabled: { type: 'boolean' },
					base_url: { type: 'string', description: 'HTTP(S) Managani base URL only, without /managani.js or widget API paths.' },
					site_key: { type: 'string', description: 'Public Managani site key.' },
					site_secret: { type: 'string', writeOnly: true, description: 'Omit or leave blank to preserve the saved secret.' },
					clear_site_secret: { type: 'boolean', description: 'Explicitly removes the saved secret. The integration must also be disabled.' },
				},
			},
			AdminCustomCodeSettings: {
				type: 'object',
				description: 'Trusted raw markup rendered in the signed-in application footer.',
				properties: {
					js_snippet: { type: 'string' },
					css_snippet: { type: 'string' },
				},
				required: ['js_snippet', 'css_snippet'],
			},
            WhiteLabelAsset: {
                type: 'object',
                nullable: true,
                properties: {
                    url: { type: 'string' },
                    mime_type: { type: 'string' },
                    size: { type: 'integer' },
                    width: { type: 'integer' },
                    height: { type: 'integer' },
                    updated_at: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            WhiteLabelSettings: {
                type: 'object',
                properties: {
                    logo: { $ref: '#/components/schemas/WhiteLabelAsset' },
                    favicon: { $ref: '#/components/schemas/WhiteLabelAsset' },
                    login_logo: { $ref: '#/components/schemas/WhiteLabelAsset' },
                    logo_url: { type: 'string' },
                    favicon_url: { type: 'string' },
                    login_logo_url: { type: 'string' },
                    dns_name_custom: { type: 'string' },
                    dns_verified: { type: 'boolean' },
                    ssl_ready: { type: 'boolean' },
                    cloudflare_status: { type: 'string' },
                    cloudflare_ssl_status: { type: 'string' },
                    dns_checked_at: { type: 'string', format: 'date-time', nullable: true },
                    cloudflare_checked_at: { type: 'string', format: 'date-time', nullable: true },
                    last_error: { type: 'string' },
                    cname_target: { type: 'string' },
                    cloudflare_configured: { type: 'boolean' },
                    can_use_custom_domain: { type: 'boolean' },
                    can_use_login_logo: { type: 'boolean' },
                },
            },
            TeamMember: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    role: { type: 'string', enum: ['owner', 'admin', 'member'] },
                    joined_at: { type: 'string', format: 'date-time' },
                    user: {
                        type: 'object',
                        properties: {
                            _id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            last_login: { type: 'string', format: 'date-time', nullable: true },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
            UserProfile: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    timezone: { type: 'string', example: 'America/New_York' },
                    time_format: { type: 'string', enum: ['12-hour', '24-hour'], description: 'Saved clock format. Omitted until the user explicitly saves a preference.' },
                },
            },
            OAuthClient: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    client_id: { type: 'string' },
                    client_name: { type: 'string' },
                    client_uri: { type: 'string', nullable: true },
                    logo_uri: { type: 'string', nullable: true },
                    redirect_uris: { type: 'array', items: { type: 'string' } },
                    jwks: { type: 'object', nullable: true },
                    jwks_uri: { type: 'string', nullable: true },
                    grant_types: { type: 'array', items: { type: 'string' } },
                    response_types: { type: 'array', items: { type: 'string' } },
                    token_endpoint_auth_method: { type: 'string', enum: ['none', 'client_secret_post', 'private_key_jwt'] },
                    registration_source: { type: 'string', enum: ['manual', 'dynamic', 'metadata'] },
                    last_used_at: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            OAuthConsent: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    client_id: { type: 'string' },
                    client_name: { type: 'string' },
                    client_uri: { type: 'string', nullable: true },
                    logo_uri: { type: 'string', nullable: true },
                    redirect_uris: { type: 'array', items: { type: 'string' } },
                    registration_source: { type: 'string', enum: ['manual', 'dynamic', 'metadata'] },
                    scopes: { type: 'array', items: { type: 'string' } },
                    resource: { type: 'string' },
                    granted_at: { type: 'string', format: 'date-time' },
                    last_used_at: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            OAuthConfig: {
                type: 'object',
                properties: {
                    issuer: { type: 'string' },
                    authorization_endpoint: { type: 'string' },
                    token_endpoint: { type: 'string' },
                    registration_endpoint: { type: 'string' },
                    authorization_server_metadata_url: { type: 'string' },
                    openid_configuration_url: { type: 'string' },
                    resource_metadata_url: { type: 'string' },
                    mcp_base_url: { type: 'string' },
                    mcp_endpoint: { type: 'string' },
                    allowed_resources: { type: 'array', items: { type: 'string' } },
                    scope_details: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                scope: { type: 'string' },
                                label: { type: 'string' },
                                description: { type: 'string' },
                            },
                        },
                    },
                    client_registration: {
                        type: 'object',
                        properties: {
                            client_id_metadata_document_supported: { type: 'boolean' },
                            dynamic_registration_supported: { type: 'boolean' },
                            pre_registration_supported: { type: 'boolean' },
                        },
                    },
                },
            },
            Note: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    project: { type: 'string' },
                    host_id: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Memory: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    project: { type: 'string' },
                    host_id: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Url: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    description: { type: 'string' },
                    text_content: { type: 'string', description: 'Plain text parsed from the saved URL and submitted for indexing.' },
                    tags: { type: 'array', items: { type: 'string' } },
                    screenshot: { type: 'string', description: 'Screenshot filename (hash)' },
                    screenshot_url: { type: 'string', description: 'Signed URL to screenshot image (time-limited)' },
                    project: { type: 'string' },
                    crawl_enabled: { type: 'boolean' },
                    is_indexed: { type: 'boolean', description: 'Whether the saved URL document was indexed successfully.' },
                    host_id: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            CrawledPage: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    crawled_at: { type: 'integer', format: 'int64', description: 'Unix timestamp for the indexed crawl.' },
                    text_content: { type: 'string', description: 'Full indexed text reconstructed from stored Typesense chunks.' },
                    index_complete: { type: 'boolean', description: 'Whether every expected indexed text chunk was available.' },
                },
            },
            Email: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    message_id: { type: 'string' },
                    references: { type: 'array', items: { type: 'string' } },
                    in_reply_to: { type: 'string' },
                    thread_key: { type: 'string', description: 'Typesense list grouping key derived from the root connected message identifier.' },
                    thread_identifiers: { type: 'array', items: { type: 'string' }, description: 'Canonical message identifiers for the connected email thread when included by realtime/update responses.' },
                    thread_source_ids: { type: 'array', items: { type: 'string' }, description: 'Email document IDs in the connected thread when included by realtime/update responses.' },
                    from: { type: 'array', items: { type: 'string' } },
                    to: { type: 'array', items: { type: 'string' } },
                    cc: { type: 'array', items: { type: 'string' } },
                    bcc: { type: 'array', items: { type: 'string' } },
                    subject: { type: 'string' },
                    text_content: { type: 'string' },
                    html_content: { type: 'string', description: 'Sanitized HTML email body. Remote image URLs are stored on data-st-remote-src until explicitly loaded by a client.' },
                    html_content_has_remote_images: { type: 'boolean' },
                    attachment_text_content: { type: 'string' },
                    excerpt: { type: 'string', description: 'Compact list excerpt. Typesense-backed list rows return this without Mongo hydration.' },
                    display_date: { type: 'string', format: 'date-time', nullable: true, description: 'Message display date using createdAt before updatedAt fallback.' },
                    thread_latest: { type: 'object', nullable: true, additionalProperties: true, description: 'Newest non-trash email in this connected thread when included by list responses for display sender/date/excerpt.' },
                    source: { type: 'string', enum: ['api', 'emailforwarding'] },
	                    mailbox: { type: 'string', enum: ['inbox', 'archived', 'sent', 'spam', 'trash'] },
	                    labels: { type: 'array', items: { type: 'string' } },
	                    in_trash: { type: 'boolean' },
	                    trashed_at: { type: 'string', format: 'date-time', nullable: true },
	                    project: { type: 'string' },
	                    host_id: { type: 'string' },
	                    createdAt: { type: 'string', format: 'date-time' },
	                    updatedAt: { type: 'string', format: 'date-time' },
	                },
	            },
            EmailLabel: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    color: { type: 'string' },
                    is_system: { type: 'boolean' },
                    is_active: { type: 'boolean' },
                    count: { type: 'integer' },
                    host_id: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                },
            },
            ByoAiProviderStatus: {
                type: 'object',
                properties: {
                    configured: { type: 'boolean' },
                    masked: { type: 'string', description: 'Masked placeholder when a custom key is configured' },
                },
            },
            ByoAiScopeSettings: {
                type: 'object',
                properties: {
                    openai_api_key: { $ref: '#/components/schemas/ByoAiProviderStatus' },
                    gemini_api_key: { $ref: '#/components/schemas/ByoAiProviderStatus' },
                },
            },
            ByoAiScopeUpdate: {
                type: 'object',
                properties: {
                    openai_api_key: { type: 'string', nullable: true, description: 'New OpenAI API key. Use null or empty string to clear.' },
                    gemini_api_key: { type: 'string', nullable: true, description: 'New Gemini API key. Use null or empty string to clear.' },
                },
            },
            ByoAiInstructions: {
                type: 'object',
                properties: {
                    global: { type: 'string', description: 'General AI behavior instructions.' },
                },
            },
            FeatureAvailability: {
                type: 'object',
                required: ['git_sync', 'email_ingest', 'obsidian_sync', 'obsidian_sync_configured'],
                properties: {
                    git_sync: { type: 'boolean' },
                    email_ingest: { type: 'boolean' },
                    obsidian_sync: { type: 'boolean', description: 'Plan access, matching Git Sync access.' },
                    obsidian_sync_configured: { type: 'boolean', description: 'Whether the server feature flag and vault encryption key are configured.' },
                },
            },
            GitRepo: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    project: { type: 'string' },
                    name: { type: 'string' },
                    repo_url: { type: 'string' },
                    branch: { type: 'string' },
                    auth_token: { type: 'string', description: 'Masked — never returned in full' },
                    sync_interval: { type: 'integer' },
                    enabled: { type: 'boolean' },
                    sync_mode: { type: 'string', enum: ['read_only', 'read_write'], description: 'read_only imports only; read_write also exports back to git' },
                    notes_path: { type: 'string' },
                    memories_path: { type: 'string' },
                    sync_path: { type: 'string' },
                    trash_on_delete: { type: 'boolean' },
                    commit_sync_enabled: { type: 'boolean' },
                    commit_history_days: { type: 'integer' },
                    last_commit_synced_at: { type: 'string', format: 'date-time', nullable: true },
                    last_commit_sha: { type: 'string' },
                    last_sync_status: { type: 'string', enum: ['success', 'failed', 'in_progress'], nullable: true },
                    last_synced_at: { type: 'string', format: 'date-time', nullable: true },
                    last_sync_error: { type: 'string' },
                    last_sync_summary: {
                        type: 'object',
                        properties: {
                            imported_files: { type: 'integer' },
                            exported_files: { type: 'integer' },
                            trashed_items: { type: 'integer' },
                            imported_commits: { type: 'integer' },
                            conflicts: { type: 'integer' },
                            skipped: { type: 'integer' },
                            started_at: { type: 'string', format: 'date-time', nullable: true },
                            finished_at: { type: 'string', format: 'date-time', nullable: true },
                            duration_ms: { type: 'integer' },
                            message: { type: 'string' },
                        },
                    },
                    sync_runs: { type: 'array', items: { type: 'object' } },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            GitSyncLog: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    repo: { type: 'string' },
                    project: { type: 'string' },
                    host_id: { type: 'string' },
                    level: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
                    message: { type: 'string' },
                    details: { type: 'object' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            GraphLink: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    source_id: { type: 'string' },
                    source_type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails'] },
                    target_id: { type: 'string' },
                    target_type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails'] },
                    label: { type: 'string' },
                    owner: { type: 'string' },
                    host_id: { type: 'string' },
                },
            },
            AuditLog: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    action: { type: 'string', enum: ['create', 'update', 'delete', 'search', 'login', 'export', 'import', 'restore', 'reindex'] },
                    resource: { type: 'string', enum: ['note', 'memory', 'url', 'email', 'project', 'link', 'user', 'passkey', 'conversation', 'trash', 'git_repo', 'team_member', 'team_invite', 'oauth_client', 'oauth_consent'] },
                    resource_id: { type: 'string' },
                    user_id: { type: 'string' },
                    host_id: { type: 'string' },
                    channel: { type: 'string', enum: ['web', 'api', 'mcp', 'emailforwarding'] },
                    token_label: { type: 'string' },
                    mcp_client: { type: 'string' },
                    details: { type: 'object' },
                    ip: { type: 'string' },
                    user_agent: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
        },
        parameters: {
            page: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            project: { name: 'project', in: 'query', schema: { type: 'string' }, description: 'Filter by project ID' },
        },
        responses: {
            AiDailyLimit: {
                description: 'The hosted tenant reached its stored daily AI workflow limit. Zero means unlimited.',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string' },
                                code: { type: 'string', enum: ['AI_DAILY_LIMIT'] },
                                limit: { type: 'integer', description: 'AI workflows allowed per day for this tenant' },
                                upgrade_url: { type: 'string', description: 'Account limits details page' },
                            },
                        },
                    },
                },
            },
        },
    },
    security: [{ BearerAuth: [] }, { AccessToken: [] }],
    paths: {
		// ---- Backend Admin Accounts ----
		'/admin/api/accounts': {
			get: {
				tags: ['Admin'],
				summary: 'List backend-admin tenant accounts',
				description: 'Returns one row per tenant, not one row per user. Requires a backend-admin session.',
				operationId: 'adminListAccounts',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				parameters: [
					{ name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'], default: 'active' } },
					{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
				],
				responses: {
					200: {
						description: 'Paginated tenant accounts',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										accounts: { type: 'array', items: { $ref: '#/components/schemas/AdminAccount' } },
										total: { type: 'integer' },
										page: { type: 'integer' },
										pages: { type: 'integer' },
										status: { type: 'string', enum: ['active', 'inactive'] },
									},
								},
							},
						},
					},
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to list accounts', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
			post: {
				tags: ['Admin'],
				summary: 'Provision a tenant account',
				description: 'Atomically creates the tenant, verified owner, owner membership, and default project. Zero limits mean unlimited. Post-commit Stripe, Typesense, or magic-link failures return warnings without rolling back the account.',
				operationId: 'adminCreateAccount',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				requestBody: {
					required: true,
					content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminAccountWrite' } } },
				},
				responses: {
					201: {
						description: 'Account created',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										ok: { type: 'boolean' },
										account: { $ref: '#/components/schemas/AdminAccount' },
										magic_link_sent: { type: 'boolean', description: 'True only when the magic-link email was submitted to configured SMTP.' },
										warnings: { type: 'array', items: { type: 'string' } },
									},
								},
							},
						},
					},
					400: { description: 'Invalid account or limit values', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					409: { description: 'Owner email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to create account', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
		},
		'/admin/api/users.csv': {
			get: {
				tags: ['Admin'],
				summary: 'Export registered users as CSV',
				description: 'Returns one row per registered user across all tenant accounts with first_name, last_name, and email columns. Requires a backend-admin session.',
				operationId: 'adminExportUsersCsv',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				responses: {
					200: {
						description: 'UTF-8 user CSV download',
						headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'Attachment filename containing the product and export date.' } },
						content: { 'text/csv': { schema: { type: 'string' } } },
					},
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to export users', content: { 'text/plain': { schema: { type: 'string' } } } },
				},
			},
		},
		'/admin/api/accounts/{tenantId}': {
			parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
			get: {
				tags: ['Admin'],
				summary: 'Get a tenant account and team members',
				operationId: 'adminGetAccount',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				responses: {
					200: { description: 'Tenant account', content: { 'application/json': { schema: { type: 'object', properties: { account: { $ref: '#/components/schemas/AdminAccount' } } } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					404: { description: 'Tenant not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
			put: {
				tags: ['Admin'],
				summary: 'Update a tenant account',
				description: 'Updates tenant identity, owner identity, status, plan, and tenant-wide limits. Lowering limits never deletes existing data. Plan changes never rewrite limits.',
				operationId: 'adminUpdateAccount',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				requestBody: {
					required: true,
					content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminAccountWrite' } } },
				},
				responses: {
					200: { description: 'Account updated', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, account: { $ref: '#/components/schemas/AdminAccount' } } } } } },
					400: { description: 'Invalid account or limit values', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					404: { description: 'Tenant not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					409: { description: 'Owner email conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
			delete: {
				tags: ['Admin'],
				summary: 'Delete a tenant account',
				description: 'Permanently deletes the exact tenant and its host-scoped Streamient data.',
				operationId: 'adminDeleteAccount',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				responses: {
					200: { description: 'Account deleted', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					404: { description: 'Tenant not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
		},
		'/admin/api/settings/managani': {
			get: {
				tags: ['Admin'],
				summary: 'Get global Managani integration settings',
				operationId: 'adminGetManaganiSettings',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				responses: {
					200: { description: 'Safe Managani settings without the site secret', content: { 'application/json': { schema: { type: 'object', properties: { settings: { $ref: '#/components/schemas/AdminManaganiSettings' } } } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to load settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
			put: {
				tags: ['Admin'],
				summary: 'Update global Managani integration settings',
				description: 'Enabling requires a base URL, public site key, and encrypted site secret. The secret is never returned.',
				operationId: 'adminUpdateManaganiSettings',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminManaganiSettingsWrite' } } } },
				responses: {
					200: { description: 'Settings updated', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, settings: { $ref: '#/components/schemas/AdminManaganiSettings' } } } } } },
					400: { description: 'Invalid or incomplete settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to update settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
		},
		'/admin/api/settings/custom-code': {
			get: {
				tags: ['Admin'],
				summary: 'Get global trusted footer code',
				operationId: 'adminGetCustomCodeSettings',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				responses: {
					200: { description: 'Current custom code', content: { 'application/json': { schema: { type: 'object', properties: { settings: { $ref: '#/components/schemas/AdminCustomCodeSettings' } } } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to load settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
			put: {
				tags: ['Admin'],
				summary: 'Update global trusted footer code',
				description: 'Stores complete trusted tags unchanged for signed-in application pages.',
				operationId: 'adminUpdateCustomCodeSettings',
				security: [{ AdminSession: [] }],
				servers: [{ url: '/', description: 'Root application endpoint' }],
				requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminCustomCodeSettings' } } } },
				responses: {
					200: { description: 'Settings updated', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, settings: { $ref: '#/components/schemas/AdminCustomCodeSettings' } } } } } },
					400: { description: 'Invalid settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					403: { description: 'Backend-admin session required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
					500: { description: 'Failed to update settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
				},
			},
		},
        // ---- Public Import Endpoints ----
        '/import/email': {
            post: {
                tags: ['Import'],
                summary: 'Import a forwarded email',
                description: 'Root-level public forwarding endpoint, not under /api/v1. The recipient must be PROJECT_ID@EMAIL_FORWARD_DOMAIN and may be supplied through envelope/provider fields such as recipient, recipients, session.recipient, envelope.to, Delivered-To, X-Original-To, Envelope-To, OriginalRecipient, SES receipt.recipients, or Received for. Plain text is imported when present; HTML-only email is stripped to text. Attachments are ignored. Matching the project email filter stores the email in trash.',
                security: [],
                servers: [{ url: '/', description: 'Root application endpoint' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    to: { type: 'string', description: 'Forwarding recipient, PROJECT_ID@EMAIL_FORWARD_DOMAIN' },
                                    from: { type: 'string', description: 'Original sender address' },
                                    bcc: { type: 'string', description: 'Parsed BCC fallback. Envelope/provider recipient fields are preferred for hidden delivery detection.' },
                                    subject: { type: 'string' },
                                    text: { type: 'string', description: 'Plain text email body' },
                                    message_id: { type: 'string' },
                                    references: { type: 'string' },
                                    in_reply_to: { type: 'string' },
                                    headers: { type: 'object', description: 'Optional parsed email headers' },
                                    attachments: { type: 'array', items: { type: 'object' }, description: 'Accepted but ignored' },
                                },
                                required: ['to', 'from'],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Accepted or safely ignored',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        accepted: { type: 'boolean' },
                                        email_id: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Recipient domain is not allowed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    503: { description: 'EMAIL_FORWARD_DOMAIN is not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- Projects ----
        '/projects': {
            get: {
                tags: ['Projects'],
                summary: 'List projects',
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } } } },
                },
            },
            post: {
                tags: ['Projects'],
                summary: 'Create a project',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' } }, required: ['name'] } } },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { project: { $ref: '#/components/schemas/Project' } } } } } },
					403: { description: 'Stored account project limit reached', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
	        '/projects/{id}': {
	            get: {
                tags: ['Projects'],
                summary: 'Get a project',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { project: { $ref: '#/components/schemas/Project' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Projects'],
                summary: 'Update a project',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' }, email_filter: { type: 'string', description: 'Incoming email trash filter rules. Supports sender address/domain/local-part rules and subject rules like `subject: failed login` or `subject contains: status update`.' } } } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { project: { $ref: '#/components/schemas/Project' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Projects'],
                summary: 'Delete a project',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    400: { description: 'Cannot delete — project still has notes, memories, URLs, or git repos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
	            },
	        },
	        '/projects/{id}/settings': {
	            get: {
	                tags: ['Projects'],
	                summary: 'Get project settings payload',
	                description: 'Returns project details, feature availability, forwarding domain, and masked git repo settings. Requires owner/admin access.',
	                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
	                responses: {
	                    200: {
	                        description: 'OK',
	                        content: {
	                            'application/json': {
	                                schema: {
	                                    type: 'object',
	                                    properties: {
	                                        project: { $ref: '#/components/schemas/Project' },
	                                        features: { $ref: '#/components/schemas/FeatureAvailability' },
	                                        email_forward_domain: { type: 'string' },
	                                        git_repos: { type: 'array', items: { $ref: '#/components/schemas/GitRepo' } },
	                                    },
	                                },
	                            },
	                        },
	                    },
	                    403: { description: 'Owner/admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	                },
	            },
	        },
	        '/features': {
	            get: {
	                tags: ['Projects'],
	                summary: 'Get account feature availability',
	                description: 'Returns plan access for Git Sync, email ingestion, and Obsidian Sync plus Obsidian server readiness.',
	                responses: {
	                    200: {
	                        description: 'OK',
	                        content: { 'application/json': { schema: { type: 'object', properties: { features: { $ref: '#/components/schemas/FeatureAvailability' } } } } },
	                    },
	                },
	            },
	        },
	        '/projects/{id}/email-filter/apply': {
	            post: {
	                tags: ['Projects'],
	                summary: 'Apply project email filter',
	                description: 'Applies saved project email filter rules to project inbox and labeled emails. Candidate selection uses Typesense; MongoDB updates are limited to matched email IDs.',
	                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
	                responses: {
	                    200: {
	                        description: 'OK',
	                        content: {
	                            'application/json': {
	                                schema: {
	                                    type: 'object',
	                                    properties: {
	                                        result: {
	                                            type: 'object',
	                                            properties: {
	                                                project: { type: 'string' },
	                                                filter_configured: { type: 'boolean' },
	                                                processed: { type: 'integer' },
	                                                matched: { type: 'integer' },
	                                                moved: { type: 'integer' },
	                                                email_ids: { type: 'array', items: { type: 'string' } },
	                                            },
	                                        },
	                                    },
	                                },
	                            },
	                        },
	                    },
	                    403: { description: 'Owner/admin or email feature access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	                },
	            },
	        },

	        // ---- Account / Team ----
        '/account/tenants': {
            get: {
                tags: ['Account'],
                summary: 'List accessible accounts / tenants',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        tenants: { type: 'array', items: { $ref: '#/components/schemas/AccountTenant' } },
                                        active_tenant_id: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/account/switch': {
            post: {
                tags: ['Account'],
                summary: 'Switch active account / tenant',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    tenant_id: { type: 'string' },
                                },
                                required: ['tenant_id'],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        active_tenant: { $ref: '#/components/schemas/AccountTenant' },
                                        tenants: { type: 'array', items: { $ref: '#/components/schemas/AccountTenant' } },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/profile': {
            put: {
                tags: ['Account'],
                summary: 'Update current user profile',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string', format: 'email' },
                                    timezone: { type: 'string', description: 'IANA timezone identifier. UTC is also accepted.', example: 'America/New_York' },
                                    time_format: { type: 'string', enum: ['12-hour', '24-hour'], description: 'Clock format to use for signed-in date and time displays.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/UserProfile' } } } } } },
                    400: { description: 'Invalid profile payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/team/members': {
            get: {
                tags: ['Team'],
                summary: 'List team members',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        members: { type: 'array', items: { $ref: '#/components/schemas/TeamMember' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Team'],
                summary: 'Create a team member',
                description: 'Adds a user to the current account with the member role. Existing Streamient users are linked to the current account; new users are created with email/password login access.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', description: 'Required only when creating a brand-new user.' },
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string', minLength: 8, description: 'Required only when creating a brand-new user.' },
                                    send_welcome_email: { type: 'boolean', default: true },
                                },
                                required: ['email'],
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { member: { $ref: '#/components/schemas/TeamMember' } } } } } },
                    400: { description: 'Invalid member payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Team admin access required or stored account user limit reached', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/team/members/{id}': {
            patch: {
                tags: ['Team'],
                summary: 'Update a team member role',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    role: { type: 'string', enum: ['admin', 'member'] },
                                },
                                required: ['role'],
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { member: { $ref: '#/components/schemas/TeamMember' } } } } } },
                },
            },
            delete: {
                tags: ['Team'],
                summary: 'Remove a team member',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                },
            },
        },
        '/oauth/config': {
            get: {
                tags: ['OAuth'],
                summary: 'Get OAuth + MCP discovery configuration for the active account',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        oauth: { $ref: '#/components/schemas/OAuthConfig' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/oauth/consents': {
            get: {
                tags: ['OAuth'],
                summary: 'List authorized OAuth apps for the active user + account',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        consents: { type: 'array', items: { $ref: '#/components/schemas/OAuthConsent' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/oauth/consents/{id}': {
            delete: {
                tags: ['OAuth'],
                summary: 'Revoke an authorized OAuth app',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                },
            },
        },
        '/oauth/clients': {
            get: {
                tags: ['OAuth'],
                summary: 'List pre-registered OAuth clients for the active account',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        clients: { type: 'array', items: { $ref: '#/components/schemas/OAuthClient' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['OAuth'],
                summary: 'Create a pre-registered OAuth client for the active account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    client_name: { type: 'string' },
                                    client_uri: { type: 'string' },
                                    redirect_uris: { type: 'array', items: { type: 'string' } },
                                    token_endpoint_auth_method: { type: 'string', enum: ['none', 'client_secret_post', 'private_key_jwt'] },
                                    jwks: { type: 'object', description: 'Public JSON Web Key Set for private_key_jwt clients' },
                                    jwks_uri: { type: 'string', description: 'HTTPS URL for a public JSON Web Key Set for private_key_jwt clients' },
                                    grant_types: { type: 'array', items: { type: 'string' } },
                                    response_types: { type: 'array', items: { type: 'string' } },
                                },
                                required: ['client_name', 'redirect_uris'],
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        client: { $ref: '#/components/schemas/OAuthClient' },
                                        client_secret: { type: 'string', nullable: true, description: 'Returned only once when token_endpoint_auth_method is client_secret_post' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/oauth/clients/{id}': {
            delete: {
                tags: ['OAuth'],
                summary: 'Delete a pre-registered OAuth client',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                },
            },
        },

        // ---- Notes ----
        '/notes': {
            get: {
                tags: ['Notes'],
                summary: 'List notes',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/limit' },
                    { $ref: '#/components/parameters/project' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'array', items: { $ref: '#/components/schemas/Note' } } } } } } },
                },
            },
            post: {
                tags: ['Notes'],
                summary: 'Create a note',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, project: { type: 'string' } }, required: ['title'] } } },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { note: { $ref: '#/components/schemas/Note' } } } } } },
                },
            },
        },
        '/notes/{id}': {
            get: {
                tags: ['Notes'],
                summary: 'Get a note',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { note: { $ref: '#/components/schemas/Note' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Notes'],
                summary: 'Update a note',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, project: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { note: { $ref: '#/components/schemas/Note' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Notes'],
                summary: 'Delete a note',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/notes/search': {
            post: {
                tags: ['Notes'],
                summary: 'Search notes',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, options: { type: 'object' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { results: { type: 'array', items: { $ref: '#/components/schemas/Note' } } } } } } },
                },
            },
        },

        // ---- Memories ----
        '/memories': {
            get: {
                tags: ['Memories'],
                summary: 'List memories',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/limit' },
                    { $ref: '#/components/parameters/project' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { memories: { type: 'array', items: { $ref: '#/components/schemas/Memory' } } } } } } },
                },
            },
            post: {
                tags: ['Memories'],
                summary: 'Store a memory',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, project: { type: 'string' } }, required: ['title'] } } },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { memory: { $ref: '#/components/schemas/Memory' } } } } } },
                },
            },
        },
        '/memories/{id}': {
            get: {
                tags: ['Memories'],
                summary: 'Get a memory',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { memory: { $ref: '#/components/schemas/Memory' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Memories'],
                summary: 'Update a memory',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, project: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { memory: { $ref: '#/components/schemas/Memory' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Memories'],
                summary: 'Delete a memory',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/memories/search': {
            post: {
                tags: ['Memories'],
                summary: 'Search memories',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, options: { type: 'object' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { results: { type: 'array', items: { $ref: '#/components/schemas/Memory' } } } } } } },
                },
            },
        },
        '/memories/tags/suggest': {
            get: {
                tags: ['Memories'],
                summary: 'Suggest memory tags',
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive tag prefix filter' },
                    { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Alias for q' },
                    { name: 'project', in: 'query', schema: { type: 'string' }, description: 'Project ID filter' },
                    { name: 'project_id', in: 'query', schema: { type: 'string' }, description: 'Alias for project' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 }, description: 'Maximum tags returned' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } } } } },
                },
            },
        },

        // ---- Emails ----
        '/emails': {
            get: {
                tags: ['Emails'],
                summary: 'List emails',
                description: 'Typesense-backed mailbox results grouped by thread_key and ordered by email created date descending. Mongo is used for detail, thread, and write paths only.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/limit' },
                    { $ref: '#/components/parameters/project' },
	                    { name: 'mailbox', in: 'query', schema: { type: 'string', enum: ['inbox', 'archived', 'sent', 'spam', 'trash'] } },
                    { name: 'label', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { emails: { type: 'array', items: { $ref: '#/components/schemas/Email' } } } } } } },
                },
            },
            post: {
                tags: ['Emails'],
                summary: 'Ingest an email (raw or parsed)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    project: { type: 'string' },
                                    raw_email: { type: 'string', description: 'Raw RFC822 email content' },
                                    parsed_email: { type: 'object', description: 'Mailparser-like JSON payload. HTML may be supplied as html, html_content, or body_html and is sanitized before storage.' },
                                    html_content: { type: 'string', description: 'Optional HTML body for flat parsed payloads. Sanitized before storage.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { email: { $ref: '#/components/schemas/Email' } } } } } },
                    400: { description: 'Invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/emails/ids': {
            get: {
                tags: ['Emails'],
                summary: 'List email IDs for current view',
                description: 'Email ID list grouped by thread using the same mailbox, label, project filters, and created-date ordering as /emails.',
                parameters: [
                    { $ref: '#/components/parameters/project' },
	                    { name: 'mailbox', in: 'query', schema: { type: 'string', enum: ['inbox', 'archived', 'sent', 'spam', 'trash'] } },
                    { name: 'label', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } } } },
                },
            },
        },
	        '/emails/{id}': {
	            get: {
	                tags: ['Emails'],
                summary: 'Get an email',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { email: { $ref: '#/components/schemas/Email' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Emails'],
                summary: 'Update an email',
	                description: 'Updates stored email metadata and content. Use DELETE to move an email to trash.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
	                requestBody: {
	                    required: true,
	                    content: { 'application/json': { schema: { type: 'object', properties: { subject: { type: 'string' }, text_content: { type: 'string' }, html_content: { type: 'string', description: 'Sanitized before storage. Send an empty string to clear stored HTML.' }, from: { type: 'array', items: { type: 'string' } }, to: { type: 'array', items: { type: 'string' } }, cc: { type: 'array', items: { type: 'string' } }, bcc: { type: 'array', items: { type: 'string' } }, project: { type: 'string' }, mailbox: { type: 'string', enum: ['inbox', 'archived', 'sent', 'spam'] }, labels: { type: 'array', items: { type: 'string' } } } } } },
	                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { email: { $ref: '#/components/schemas/Email' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Emails'],
                summary: 'Delete an email',
                description: 'Moves the email to trash and clears all labels.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/emails/{id}/thread': {
            get: {
                tags: ['Emails'],
                summary: 'Get thread by message references',
	                parameters: [
	                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
	                    { name: 'order', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
	                ],
	                responses: {
	                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { thread: { type: 'array', items: { $ref: '#/components/schemas/Email' } } } } } } },
	                },
	            },
	        },
        '/emails/search': {
            post: {
                tags: ['Emails'],
                summary: 'Search emails',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, options: { type: 'object' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { results: { type: 'array', items: { $ref: '#/components/schemas/Email' } } } } } } },
                },
            },
        },
	        // ---- URLs ----
        '/urls': {
            get: {
                tags: ['URLs'],
                summary: 'List URLs',
				description: 'Returns saved URLs ordered by creation date, newest first.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/limit' },
                    { $ref: '#/components/parameters/project' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { urls: { type: 'array', items: { $ref: '#/components/schemas/Url' } } } } } } },
                },
            },
            post: {
                tags: ['URLs'],
                summary: 'Save a URL',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, project: { type: 'string' }, crawl_enabled: { type: 'boolean' }, screenshot_data_url: { type: 'string', description: 'Optional browser-captured screenshot data URL for authenticated or paywalled pages.' } }, required: ['url'] } } },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { url: { $ref: '#/components/schemas/Url' } } } } } },
                    200: { description: 'URL already saved', content: { 'application/json': { schema: { type: 'object', properties: { url: { $ref: '#/components/schemas/Url' }, duplicate: { type: 'boolean' } } } } } },
                },
            },
        },
        '/urls/{id}': {
            get: {
                tags: ['URLs'],
                summary: 'Get a URL',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { url: { $ref: '#/components/schemas/Url' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['URLs'],
                summary: 'Update a URL',
                description: 'Set crawl_enabled to false to stop URL path crawling and remove crawled page documents for this URL from the pages index.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, project: { type: 'string' }, crawl_enabled: { type: 'boolean' } } } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { url: { $ref: '#/components/schemas/Url' }, deleted_pages: { type: 'integer', description: 'Number of crawled page documents removed when crawling was disabled.' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['URLs'],
                summary: 'Delete a URL',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/urls/{id}/pages': {
            get: {
                tags: ['URLs'],
                summary: 'List indexed crawled pages',
				description: 'Returns one row per indexed crawled URL, ordered by crawl date with the newest first. Pagination and counts exclude additional text chunks.',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { type: 'object', properties: { pages: { type: 'array', items: { $ref: '#/components/schemas/CrawledPage' } }, count: { type: 'integer' }, page: { type: 'integer' }, per_page: { type: 'integer' } } } } },
                    },
                    404: { description: 'URL not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    500: { description: 'Failed to load crawled pages', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/urls/{id}/pages/{pageId}': {
            get: {
                tags: ['URLs'],
                summary: 'Get indexed crawled-page text',
                description: 'Returns one crawled page with its full indexed text reconstructed from ordered, overlapping Typesense chunks.',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'pageId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { page: { $ref: '#/components/schemas/CrawledPage' } } } } } },
                    404: { description: 'URL or crawled page not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    500: { description: 'Failed to load indexed page text', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/urls/{id}/resync': {
            post: {
                tags: ['URLs'],
                summary: 'Resync crawled URL pages',
                description: 'Deletes existing crawled page documents for this URL, then starts URL path crawling in the background.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Resync started', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, deleted_pages: { type: 'integer', description: 'Number of crawled page documents removed before resync.' } } } } } },
                    400: { description: 'Crawling disabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/urls/search': {
            post: {
                tags: ['URLs'],
                summary: 'Search URLs',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, options: { type: 'object' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { results: { type: 'array', items: { $ref: '#/components/schemas/Url' } } } } } } },
                },
            },
        },

        // ---- Screenshots ----
        '/screenshots/{filename}': {
            get: {
                tags: ['Screenshots'],
                summary: 'Get a screenshot image (signed URL)',
                description: 'Serves a screenshot image. Requires valid HMAC signature and unexpired timestamp. No authentication needed.',
                security: [],
                parameters: [
                    { name: 'filename', in: 'path', required: true, schema: { type: 'string' }, description: 'Screenshot filename (SHA-256 hash + .png)' },
                    { name: 'expires', in: 'query', required: true, schema: { type: 'integer' }, description: 'Expiration timestamp (Unix epoch seconds)' },
                    { name: 'sig', in: 'query', required: true, schema: { type: 'string' }, description: 'HMAC-SHA256 signature' },
                ],
                responses: {
                    200: { description: 'PNG image', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } },
                    403: { description: 'Invalid or expired signature', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Screenshot not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- Batch Operations ----
        '/batch/count': {
            get: {
                tags: ['Batch'],
                summary: 'Get total item count for select-all',
                description: 'Returns the total number of items of a given type, optionally filtered by project. Uses Typesense for performance.',
                parameters: [
                    { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] } },
                    { name: 'project', in: 'query', schema: { type: 'string' }, description: 'Filter by project ID' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } },
                },
            },
        },
        '/batch/delete': {
            post: {
                tags: ['Batch'],
                summary: 'Batch delete items',
                description: 'For emails, moves each email to trash and clears all labels.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] }, ids: { type: 'array', items: { type: 'string' } }, all: { type: 'boolean', description: 'When true, delete all items of the given type (ids is ignored)' }, filterProject: { type: 'string', description: 'Filter by project ID when all=true' } }, required: ['type'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, deleted: { type: 'integer' } } } } } },
                },
            },
        },
        '/batch/move': {
            post: {
                tags: ['Batch'],
                summary: 'Batch move items to a project',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] }, ids: { type: 'array', items: { type: 'string' } }, all: { type: 'boolean', description: 'When true, move all items of the given type (ids is ignored)' }, filterProject: { type: 'string', description: 'Filter by source project ID when all=true' }, project: { type: 'string' } }, required: ['type', 'project'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, moved: { type: 'integer' } } } } } },
                },
            },
        },
        '/batch/copy': {
            post: {
                tags: ['Batch'],
                summary: 'Batch copy items to a project',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] }, ids: { type: 'array', items: { type: 'string' } }, all: { type: 'boolean', description: 'When true, copy all items of the given type (ids is ignored)' }, filterProject: { type: 'string', description: 'Filter by source project ID when all=true' }, project: { type: 'string' } }, required: ['type', 'project'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, copied: { type: 'integer' } } } } } },
                },
            },
        },

        // ---- Search ----
        '/search/all': {
            post: {
                tags: ['Search'],
                summary: 'Search linkable items across all collections',
                description: 'Returns note, memory, URL, and enabled email matches with project names and Unix timestamps for the link picker.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        results: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    _type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails'] },
                                                    title: { type: 'string' },
                                                    subject: { type: 'string' },
                                                    url: { type: 'string' },
                                                    project_id: { type: 'string' },
                                                    project_name: { type: 'string' },
                                                    created_at: { type: 'integer', format: 'int64', description: 'Unix timestamp in seconds' },
                                                    updated_at: { type: 'integer', format: 'int64', description: 'Unix timestamp in seconds' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/search/knowledge': {
            post: {
                tags: ['Search'],
                summary: 'Search knowledge (notes + memories + URLs + emails + pages)',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, project_id: { type: 'string', description: 'Filter by project (optional)' }, per_page: { type: 'integer', description: 'Results per collection (default 5)' }, options: { type: 'object' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { results: { type: 'object' } } } } } },
                },
            },
        },
        '/search/quick': {
            post: {
                tags: ['Search'],
                summary: 'Fast lexical search for the top search palette',
                description: 'Searches notes, memories, URLs, pages, and emails when email access is enabled. Returns normalized records with safe highlight segments and client open targets.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string' },
                                    project_id: { type: 'string', description: 'Filter by project (optional)' },
                                    per_page: { type: 'integer', description: 'Results per collection before final merge' },
                                    limit: { type: 'integer', description: 'Maximum normalized results to return' },
                                },
                                required: ['query'],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        query: { type: 'string' },
                                        found: { type: 'integer' },
                                        results: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails', 'pages'] },
                                                    title: { type: 'string' },
                                                    subtitle: { type: 'string' },
                                                    excerpt: { type: 'string' },
                                                    highlight_field: { type: 'string' },
                                                    highlight_segments: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, highlighted: { type: 'boolean' } } } },
                                                    project_id: { type: 'string' },
                                                    updated_at: { type: 'integer', nullable: true },
                                                    open_target: { type: 'object' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    500: { description: 'Search failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- Resolve ----
        '/resolve': {
            post: {
                tags: ['Utility'],
                summary: 'Resolve IDs to titles',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, _type: { type: 'string' } } } } } } } } },
                },
            },
        },

        // ---- Counts ----
        '/counts': {
            get: {
                tags: ['Utility'],
                summary: 'Get project item counts',
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },

        // ---- Reindex ----
        '/reindex': {
            post: {
                tags: ['Utility'],
                summary: 'Reindex Typesense collections',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['idle', 'queued', 'progress', 'complete'] },
                                        message: { type: 'string' },
                                        total_queued: { type: 'integer' },
                                        indexed: { type: 'integer' },
                                        remaining: { type: 'integer' },
                                        started_at: { type: 'string', format: 'date-time' },
                                        counts: {
                                            type: 'object',
                                            properties: {
                                                db_records: { type: 'integer' },
                                                indexed_records: { type: 'integer' },
                                                not_indexed_records: { type: 'integer' },
                                                by_type: {
                                                    type: 'object',
                                                    additionalProperties: {
                                                        type: 'object',
                                                        properties: {
                                                            db_records: { type: 'integer' },
                                                            indexed_records: { type: 'integer' },
                                                            not_indexed_records: { type: 'integer' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        results: {
                                            type: 'object',
                                            properties: {
                                                notes: { type: 'object', properties: { queued: { type: 'integer' } } },
                                                memory: { type: 'object', properties: { queued: { type: 'integer' } } },
                                                urls: { type: 'object', properties: { queued: { type: 'integer' } } },
                                                emails: { type: 'object', properties: { queued: { type: 'integer' } } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/reindex/status': {
            get: {
                tags: ['Utility'],
                summary: 'Get search reindex status',
                description: 'Returns the current account search reindex state. Use as a polling fallback when socket progress events are missed.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['idle', 'queued', 'progress', 'complete'] },
                                        total_queued: { type: 'integer' },
                                        indexed: { type: 'integer' },
                                        remaining: { type: 'integer' },
                                        started_at: { type: 'string', format: 'date-time' },
                                        message: { type: 'string' },
                                        counts: {
                                            type: 'object',
                                            properties: {
                                                db_records: { type: 'integer' },
                                                indexed_records: { type: 'integer' },
                                                not_indexed_records: { type: 'integer' },
                                                by_type: {
                                                    type: 'object',
                                                    additionalProperties: {
                                                        type: 'object',
                                                        properties: {
                                                            db_records: { type: 'integer' },
                                                            indexed_records: { type: 'integer' },
                                                            not_indexed_records: { type: 'integer' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- BYO AI Settings ----
        '/settings/byo-ai': {
            get: {
                tags: ['Settings'],
                summary: 'Get BYO AI key status',
                description: 'Returns masked/configured status for hosted Pro account BYO AI API keys. Raw API keys are never returned.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: {
                                            type: 'object',
                                            properties: {
                                                global: { $ref: '#/components/schemas/ByoAiScopeSettings' },
                                                email: { $ref: '#/components/schemas/ByoAiScopeSettings' },
                                                instructions: { $ref: '#/components/schemas/ByoAiInstructions' },
                                                email_settings: { $ref: '#/components/schemas/EmailSettings' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Hosted Pro account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Settings'],
                summary: 'Update BYO AI API keys',
                description: 'Stores or clears hosted Pro account BYO AI API keys. Omitted fields are left unchanged; null or empty string clears a key.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    global: { $ref: '#/components/schemas/ByoAiScopeUpdate' },
                                    email: { $ref: '#/components/schemas/ByoAiScopeUpdate' },
                                    instructions: { $ref: '#/components/schemas/ByoAiInstructions' },
                                    email_settings: { $ref: '#/components/schemas/EmailSettings' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: {
                                            type: 'object',
                                            properties: {
                                                global: { $ref: '#/components/schemas/ByoAiScopeSettings' },
                                                email: { $ref: '#/components/schemas/ByoAiScopeSettings' },
                                                instructions: { $ref: '#/components/schemas/ByoAiInstructions' },
                                                email_settings: { $ref: '#/components/schemas/EmailSettings' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid key payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Hosted Pro account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- White-label Settings ----
        '/settings/white-label': {
            get: {
                tags: ['Settings'],
                summary: 'Get white-label settings',
                description: 'Returns account white-label branding and custom domain status. Requires owner/admin access.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Settings'],
                summary: 'Update white-label settings',
                description: 'Updates Pro custom domain configuration. Asset uploads use the asset endpoints.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    dns_name_custom: { type: 'string', description: 'Custom login/app domain. Empty string clears it.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid white-label payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Account admin or Pro access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    409: { description: 'Custom domain already mapped', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/settings/white-label/domain/verify': {
            post: {
                tags: ['Settings'],
                summary: 'Verify white-label custom domain',
                description: 'Checks the CNAME target and provisions or refreshes the Cloudflare Custom Hostname. Requires owner/admin and Pro access.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'DNS or Cloudflare configuration issue', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Account admin or Pro access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/settings/white-label/domain/refresh': {
            post: {
                tags: ['Settings'],
                summary: 'Refresh white-label custom domain status',
                description: 'Refreshes Cloudflare Custom Hostname and SSL status. Requires owner/admin and Pro access.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'DNS or Cloudflare configuration issue', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Account admin or Pro access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/settings/white-label/assets/{kind}': {
            post: {
                tags: ['Settings'],
                summary: 'Upload white-label asset',
                description: 'Uploads and normalizes a white-label image to PNG. `logo` and `favicon` are available on Free. `login_logo` requires Pro.',
                parameters: [
                    { name: 'kind', in: 'path', required: true, schema: { type: 'string', enum: ['logo', 'favicon', 'login_logo'] } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' },
                                },
                                required: ['file'],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid image upload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Account admin or Pro access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Settings'],
                summary: 'Remove white-label asset',
                description: 'Removes a white-label asset. `login_logo` requires Pro.',
                parameters: [
                    { name: 'kind', in: 'path', required: true, schema: { type: 'string', enum: ['logo', 'favicon', 'login_logo'] } },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        settings: { $ref: '#/components/schemas/WhiteLabelSettings' },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin or Pro access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Unknown asset kind', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },

        // ---- AI Chat ----
        '/chat': {
            post: {
                tags: ['AI Chat'],
                summary: 'AI-powered chat with intent classification',
                description: 'Classifies the query intent (search, action, analysis, conversation), routes to the appropriate handler, and returns results + conversational answer. Results are displayed in the main panel.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string', description: 'User message or query' }, conversation_id: { type: 'string', description: 'Continue an existing conversation (optional)' }, project_id: { type: 'string', description: 'Scope search/actions to a project (optional)' } }, required: ['query'] } } },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        answer: { type: 'string', description: 'Conversational response' },
                                        results: { type: 'array', items: { type: 'object' }, description: 'Matching items from knowledge base' },
                                        action: { type: 'object', nullable: true, description: 'Action performed or pending confirmation' },
                                        conversation_id: { type: 'string', description: 'Conversation ID for follow-up messages' },
                                        conversation_reset: { type: 'boolean', description: 'True when the requested conversation was invalid/expired and a new thread was started automatically' },
                                        previous_conversation_id: { type: 'string', description: 'The stale conversation ID that was replaced, when conversation_reset is true' },
                                        display_in: { type: 'string', enum: ['panel', 'chat'], description: 'Where results should be displayed' },
                                    },
                                },
                            },
                        },
                    },
                    429: { $ref: '#/components/responses/AiDailyLimit' },
                },
            },
        },
        '/chat/stream': {
            post: {
                tags: ['AI Chat'],
                summary: 'AI-powered chat with streaming SSE response',
                description: 'Same intent classification as POST /chat, but streams the answer as Server-Sent Events. For stats and analysis intents, LLM tokens are streamed incrementally. For search/conversation/action intents, the answer is sent as a single token event. A final "done" event contains metadata (conversation_id, results, action, display_in).',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string', description: 'User message or query' }, conversation_id: { type: 'string', description: 'Continue an existing conversation (optional)' }, project_id: { type: 'string', description: 'Scope search/actions to a project (optional)' } }, required: ['query'] } } },
                },
                responses: {
                    200: {
                        description: 'SSE stream with events: token ({"text":"..."}), done ({"conversation_id":"...", "results":[], "action":null, "display_in":"panel|chat"}), error ({"error":"..."})',
                        content: { 'text/event-stream': { schema: { type: 'string' } } },
                    },
                    429: { $ref: '#/components/responses/AiDailyLimit' },
                },
            },
        },
        '/chat/conversations': {
            get: {
                tags: ['AI Chat'],
                summary: 'List recent conversations',
                parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { conversations: { type: 'array', items: { type: 'object', properties: { conversation_id: { type: 'string' }, title: { type: 'string' }, timestamp: { type: 'integer' } } } } } } } } },
                },
            },
        },
        '/chat/conversations/{id}': {
            delete: {
                tags: ['AI Chat'],
                summary: 'Delete a conversation',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                },
            },
        },
        '/chat/search': {
            post: {
                tags: ['AI Chat'],
                summary: 'AI-powered chat search (legacy)',
                deprecated: true,
                description: 'Deprecated. Use POST /chat instead.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, stream: { type: 'boolean', description: 'Enable SSE streaming' } }, required: ['query'] } } },
                },
                responses: {
                    200: { description: 'OK (JSON or SSE stream)', content: { 'application/json': { schema: { type: 'object', properties: { answer: { type: 'string' } } } } } },
                    429: { $ref: '#/components/responses/AiDailyLimit' },
                },
            },
        },

        // ---- Trash ----
        '/trash': {
            get: {
                tags: ['Trash'],
                summary: 'List trashed items',
                description: 'Typesense-backed mixed trash listing for notes, memories, URLs, and emails. Exact totals count only chunk_index 0 anchor documents from one tenant-scoped multi-search. Items are sorted by trashed_at descending.',
                parameters: [
                    { name: 'type', in: 'query', schema: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] } },
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/limit' },
                    { name: 'offset', in: 'query', description: 'Optional continuation offset used by incremental clients after local mutations.', schema: { type: 'integer', minimum: 0 } },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
                    503: { description: 'Typesense unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Trash'],
                summary: 'Empty trash',
                description: 'Permanently deletes Mongo trash records and every matching Typesense trash document, including orphaned index documents.',
                parameters: [{ name: 'confirm', in: 'query', required: true, schema: { type: 'string', enum: ['true'] } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, deleted: { type: 'integer' } } } } } },
                },
            },
        },
        '/trash/count': {
            get: {
                tags: ['Trash'],
                summary: 'Get trash item count',
                description: 'Exact Typesense anchor-document count across notes, memories, URLs, and emails from one tenant-scoped multi-search. Errors propagate so clients can retain their previous count.',
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } },
                    503: { description: 'Typesense unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/trash/restore': {
            post: {
                tags: ['Trash'],
                summary: 'Restore a trashed item',
                description: 'Restores an existing Mongo record. If Mongo no longer contains it, removes the stale Typesense document and returns 404.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] }, id: { type: 'string' } }, required: ['type', 'id'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, item: { type: 'object' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/trash/{type}/{id}': {
            delete: {
                tags: ['Trash'],
                summary: 'Permanently delete a trashed item',
                description: 'Idempotent. Always removes the requested Typesense source ID and returns success when Mongo already removed the record.',
                parameters: [
                    { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] } },
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Deleted or already absent', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, deleted: { type: 'boolean' }, already_missing: { type: 'boolean' } } } } } },
                },
            },
        },
        '/trash/batch/restore': {
            post: {
                tags: ['Trash'],
                summary: 'Batch restore trashed items',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, id: { type: 'string' } } } } }, required: ['items'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, restored: { type: 'integer' } } } } } },
                },
            },
        },
        '/trash/batch/delete': {
            post: {
                tags: ['Trash'],
                summary: 'Batch permanently delete trashed items',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, id: { type: 'string' } } } } }, required: ['items'] } } },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, deleted: { type: 'integer' } } } } } },
                },
            },
        },
        '/links': {
            post: {
                tags: ['Graph'],
                summary: 'Create a link between two items',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { source_id: { type: 'string' }, source_type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails'] }, target_id: { type: 'string' }, target_type: { type: 'string', enum: ['notes', 'memory', 'urls', 'emails'] }, label: { type: 'string' } }, required: ['source_id', 'source_type', 'target_id', 'target_type'] } } },
                },
                responses: {
                    201: { description: 'Link created', content: { 'application/json': { schema: { type: 'object', properties: { link: { $ref: '#/components/schemas/GraphLink' } } } } } },
                    409: { description: 'Link already exists' },
                },
            },
        },
        '/links/{id}': {
            delete: {
                tags: ['Graph'],
                summary: 'Delete a link',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Link deleted' },
                    404: { description: 'Link not found' },
                },
            },
        },
        '/links/{itemId}': {
            get: {
                tags: ['Graph'],
                summary: 'Get all links for an item',
                parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { links: { type: 'array', items: { $ref: '#/components/schemas/GraphLink' } } } } } } },
                },
            },
        },
        '/graph': {
            get: {
                tags: ['Graph'],
                summary: 'Get the knowledge graph data (nodes and edges)',
                parameters: [
                    { name: 'project_id', in: 'query', schema: { type: 'string' }, description: 'Filter by project' },
                    { name: 'include_tags', in: 'query', schema: { type: 'string', default: 'true' }, description: 'Include tag-based edges' },
                    { name: 'include_semantic', in: 'query', schema: { type: 'string', default: 'false' }, description: 'Include semantic similarity edges' },
                    { name: 'semantic_threshold', in: 'query', schema: { type: 'number', default: 0.7 }, description: 'Semantic similarity threshold' },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { nodes: { type: 'array', items: { type: 'object' } }, edges: { type: 'array', items: { type: 'object' } } } } } } },
                },
            },
        },
        // ---- Health ----
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Liveness probe',
                description: 'Returns 200 if the process is up. No auth required. Mounted at /health (not under /api/v1).',
                security: [],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
                },
            },
        },
        '/health/mongodb': {
            get: {
                tags: ['Health'],
                summary: 'MongoDB health',
                description: 'Returns 200 if MongoDB connection is ready, 503 otherwise. No auth required.',
                security: [],
                responses: {
                    200: { description: 'MongoDB healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
                    503: { description: 'MongoDB unavailable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'unavailable' } } } } } },
                },
            },
        },
        '/health/memcached': {
            get: {
                tags: ['Health'],
                summary: 'Memcached health',
                description: 'Returns 200 when at least one Memcached node is reachable, 503 otherwise. No auth required.',
                security: [],
                responses: {
                    200: { description: 'Memcached reachable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
                    503: { description: 'Memcached unavailable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'unavailable' } } } } } },
                },
            },
        },
        '/health/typesense': {
            get: {
                tags: ['Health'],
                summary: 'Typesense health',
                description: 'Returns 200 if Typesense is healthy, 503 otherwise. No auth required.',
                security: [],
                responses: {
                    200: { description: 'Typesense healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
                    503: { description: 'Typesense unavailable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'unavailable' } } } } } },
                },
            },
        },
        '/health/websocket': {
            get: {
                tags: ['Health'],
                summary: 'WebSocket health',
                description: 'Returns 200 if Socket.IO is initialized, 503 otherwise. No auth required.',
                security: [],
                responses: {
                    200: { description: 'WebSocket healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, mode: { type: 'string' }, app: { type: 'string' }, otel_enabled: { type: 'boolean' }, clients: { type: 'integer' } } } } } },
                    503: { description: 'WebSocket unavailable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'not_initialized' }, mode: { type: 'string' }, app: { type: 'string' }, otel_enabled: { type: 'boolean' }, clients: { type: 'integer' } } } } } },
                },
            },
        },
        // ---- Audit Logs ----
        '/audit-logs': {
            get: {
                tags: ['Audit Logs'],
                summary: 'List audit logs',
                description: 'Returns paginated audit logs for the current tenant. Supports filtering by resource, action, channel, date range, and free-text search.',
                parameters: [
                    { name: 'resource', in: 'query', schema: { type: 'string', enum: ['note', 'memory', 'url', 'project', 'link', 'user', 'passkey', 'conversation', 'trash'] } },
                    { name: 'action', in: 'query', schema: { type: 'string', enum: ['create', 'update', 'delete', 'search', 'login', 'export', 'import', 'restore', 'reindex'] } },
                    { name: 'channel', in: 'query', schema: { type: 'string', enum: ['web', 'api', 'mcp'] } },
                    { name: 'mcp_client', in: 'query', schema: { type: 'string' }, description: 'Filter by MCP client name' },
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text search across resource_id, token_label, mcp_client' },
                    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date (inclusive)' },
                    { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date (inclusive)' },
                    { $ref: '#/components/parameters/page' },
                    { name: 'per_page', in: 'query', schema: { type: 'integer', default: 50 } },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        logs: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
                                        total: { type: 'integer' },
                                        page: { type: 'integer' },
                                        pages: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        // ---- Export ----
        '/export': {
            post: {
                tags: ['Export'],
                summary: 'Start a full data export',
                description: 'Starts an account export for the current tenant. Available to account owners and admins only.',
                responses: {
                    200: {
                        description: 'Export started',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        export_id: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    409: { description: 'Export already in progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/export/status': {
            get: {
                tags: ['Export'],
                summary: 'Get export status',
                description: 'Returns the current export job status for the active account. Available to account owners and admins only.',
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', nullable: true },
                                        error: { type: 'string' },
                                        expires_at: { type: 'string', format: 'date-time' },
                                        token: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/export/download/{token}': {
            get: {
                tags: ['Export'],
                summary: 'Download completed export archive',
                description: 'Downloads the generated ZIP export for the active account. Available to account owners and admins only.',
                parameters: [
                    { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'ZIP archive', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } },
                    403: { description: 'Account admin access required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Export not found or expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        // ---- Git Sync ----
        '/projects/{id}/git-repos': {
            get: {
                tags: ['Git Sync'],
                summary: 'List git repos for a project',
                description: 'Returns all configured git repos for the given project. Requires Pro plan or self-hosted (free) edition.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Project ID' }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { repos: { type: 'array', items: { $ref: '#/components/schemas/GitRepo' } } } } } } },
                    403: { description: 'Plan not eligible', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            post: {
                tags: ['Git Sync'],
                summary: 'Add a git repo to a project',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Project ID' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', description: 'Friendly label' },
                                    repo_url: { type: 'string', description: 'HTTPS git repo URL' },
                                    branch: { type: 'string', default: 'main' },
                                    auth_token: { type: 'string', description: 'Personal access token (stored encrypted)' },
                                    sync_mode: { type: 'string', enum: ['read_only', 'read_write'], default: 'read_only', description: 'read_only (default) imports only; read_write also exports notes/memories back to git' },
                                    sync_interval: { type: 'integer', default: 10, description: 'Sync interval in minutes (min 5)' },
                                    notes_path: { type: 'string', default: 'notes', description: 'Directory mapped to notes' },
                                    memories_path: { type: 'string', default: 'memories', description: 'Directory mapped to memories' },
                                    sync_path: { type: 'string', default: '/', description: 'Subfolder within repo to sync' },
                                    trash_on_delete: { type: 'boolean', default: true },
                                    commit_sync_enabled: { type: 'boolean', default: true, description: 'Import git commits as memories' },
                                    commit_history_days: { type: 'integer', default: 90, description: 'Days of commit history to backfill on first sync' },
                                },
                                required: ['repo_url'],
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { repo: { $ref: '#/components/schemas/GitRepo' } } } } } },
                    400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    403: { description: 'Plan not eligible', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/git-repos/{id}': {
            get: {
                tags: ['Git Sync'],
                summary: 'Get a git repo',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { repo: { $ref: '#/components/schemas/GitRepo' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            put: {
                tags: ['Git Sync'],
                summary: 'Update a git repo',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    repo_url: { type: 'string' },
                                    branch: { type: 'string' },
                                    auth_token: { type: 'string' },
                                    sync_interval: { type: 'integer' },
                                    enabled: { type: 'boolean' },
                                    sync_mode: { type: 'string', enum: ['read_only', 'read_write'], description: 'read_only imports only; read_write also exports back to git' },
                                    notes_path: { type: 'string' },
                                    memories_path: { type: 'string' },
                                    sync_path: { type: 'string' },
                                    trash_on_delete: { type: 'boolean' },
                                    commit_sync_enabled: { type: 'boolean' },
                                    commit_history_days: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { repo: { $ref: '#/components/schemas/GitRepo' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Git Sync'],
                summary: 'Delete a git repo',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/git-repos/{id}/sync': {
            post: {
                tags: ['Git Sync'],
                summary: 'Trigger manual sync',
                description: 'Immediately syncs the git repo (pull + push). Returns when complete unless background is true.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    background: { type: 'boolean', default: false, description: 'Start sync in the background and return immediately' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Sync complete', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, summary: { type: 'object' } } } } } },
                    202: { description: 'Sync started', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, summary: { type: 'object' } } } } } },
                    400: { description: 'Sync failed or in progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/git-repos/{id}/logs': {
            get: {
                tags: ['Git Sync'],
                summary: 'Get sync logs',
                description: 'Returns git sync log entries retained for the last 14 days.',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 200, maximum: 500 } },
                ],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { logs: { type: 'array', items: { $ref: '#/components/schemas/GitSyncLog' } } } } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
	        '/git-repos/{id}/status': {
	            get: {
                tags: ['Git Sync'],
                summary: 'Get sync status',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['success', 'failed', 'in_progress'], nullable: true },
                                        last_synced_at: { type: 'string', format: 'date-time', nullable: true },
                                        last_commit_synced_at: { type: 'string', format: 'date-time', nullable: true },
                                        last_commit_sha: { type: 'string' },
                                        summary: { type: 'object' },
                                        runs: { type: 'array', items: { type: 'object' } },
                                        error: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	                },
	            },
	        },
	    },
	};

swaggerSpec.components.securitySchemes.MobileOAuth = {
	type: 'oauth2',
	description: 'OAuth 2.0 Authorization Code with PKCE for Streamient Mobile. Client: streamient-mobile.',
	flows: {
		authorizationCode: {
			authorizationUrl: '/oauth/authorize',
			tokenUrl: '/oauth/token',
			scopes: {
				'knowledge:read': 'Read projects and knowledge records',
				'knowledge:write': 'Create notes, save URLs, and import documents',
				'ai:chat': 'Use streaming AI chat and history',
				'profile:write': 'Update profile and mobile preferences',
			},
		},
	},
};

Object.assign(swaggerSpec.components.schemas, {
	MobileRecordSummary: {
		type: 'object',
		required: ['key', 'type', 'id', 'project_id', 'title', 'excerpt', 'created_at', 'updated_at', 'metadata'],
		properties: {
			key: { type: 'string', example: 'notes:64f0c3e72e62bd2ea6c41a11' },
			type: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] },
			id: { type: 'string' },
			project_id: { type: 'string' },
			title: { type: 'string' },
			excerpt: { type: 'string' },
			created_at: { type: 'string', format: 'date-time' },
			updated_at: { type: 'string', format: 'date-time' },
			metadata: { type: 'object', additionalProperties: true },
		},
	},
	MobileUploadSession: {
		type: 'object',
		required: ['id', 'project_id', 'original_name', 'upload_length', 'upload_offset', 'chunk_size', 'state'],
		properties: {
			id: { type: 'string' },
			project_id: { type: 'string' },
			original_name: { type: 'string', example: 'research.pdf' },
			title: { type: 'string' },
			mime_type: { type: 'string' },
			upload_length: { type: 'integer', format: 'int64', description: 'Total bytes. No application-level maximum.' },
			upload_offset: { type: 'integer', format: 'int64' },
			chunk_size: { type: 'integer', enum: [20000000] },
			state: { type: 'string', enum: ['uploading', 'processing', 'complete', 'failed', 'canceled'] },
			note_id: { type: 'string', nullable: true },
			error: { type: 'string', nullable: true },
			expires_at: { type: 'string', format: 'date-time' },
		},
	},
});

const mobileReadSecurity = [{ MobileOAuth: ['knowledge:read'] }];
const mobileWriteSecurity = [{ MobileOAuth: ['knowledge:write'] }];
const mobileErrorResponses = {
	400: { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
	401: { description: 'Missing or expired OAuth access token' },
	403: { description: 'Insufficient OAuth scope or tenant access' },
};

Object.assign(swaggerSpec.paths, {
	'/mobile/bootstrap': {
		get: { tags: ['Mobile'], summary: 'Bootstrap the saved mobile account', security: mobileReadSecurity, responses: { ...mobileErrorResponses, 200: { description: 'User, projects, feature flags, and changes cursor' } } },
	},
	'/mobile/projects': {
		get: { tags: ['Mobile'], summary: 'List active projects with per-type counts', security: mobileReadSecurity, responses: { ...mobileErrorResponses, 200: { description: 'Default project first, then alphabetical' } } },
	},
	'/mobile/projects/counts': {
		get: { tags: ['Mobile'], summary: 'Refresh project counts only', security: mobileReadSecurity, responses: { ...mobileErrorResponses, 200: { description: 'Project count snapshot' } } },
	},
	'/mobile/records': {
		get: {
			tags: ['Mobile'], summary: 'List the stable-cursor unified record feed', security: mobileReadSecurity,
			parameters: [{ name: 'project_id', in: 'query', required: true, schema: { type: 'string' } }, { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'notes', 'memories', 'urls', 'emails'] } }, { name: 'cursor', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
			responses: { ...mobileErrorResponses, 200: { description: 'Newest-updated records', content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { $ref: '#/components/schemas/MobileRecordSummary' } }, next_cursor: { type: 'string', nullable: true } } } } } } },
		},
	},
	'/mobile/records/changes': {
		get: { tags: ['Mobile'], summary: 'Fetch incremental record changes after reconnect', security: mobileReadSecurity, parameters: [{ name: 'cursor', in: 'query', required: true, schema: { type: 'string' } }, { name: 'project_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Idempotent upsert/delete change list and next cursor' } } },
	},
	'/mobile/records/{type}/{id}': {
		get: { tags: ['Mobile'], summary: 'Get a mobile record detail', security: mobileReadSecurity, parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['notes', 'memories', 'urls', 'emails'] } }, { name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Record detail' }, 404: { description: 'Record not found' } } },
	},
	'/mobile/search': {
		get: { tags: ['Mobile'], summary: 'Search active or all projects', security: mobileReadSecurity, parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'project_id', in: 'query', schema: { type: 'string' } }, { name: 'all_projects', in: 'query', schema: { type: 'boolean' } }, { name: 'type', in: 'query', schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Normalized search results' } } },
	},
	'/mobile/notes': {
		post: { tags: ['Mobile'], summary: 'Create a note', security: mobileWriteSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['project_id'], properties: { project_id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, text_content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } } }, responses: { ...mobileErrorResponses, 201: { description: 'Note created' } } },
	},
	'/mobile/notes/tags': {
		get: { tags: ['Mobile'], summary: 'List available note and memory tags', security: mobileReadSecurity, parameters: [{ name: 'project_id', in: 'query', schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Sorted unique tags' } } },
	},
	'/mobile/notes/{id}': {
		put: { tags: ['Mobile'], summary: 'Update an editable note', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { ...mobileErrorResponses, 200: { description: 'Note updated' }, 404: { description: 'Note not found' } } },
	},
	'/mobile/urls': {
		post: { tags: ['Mobile'], summary: 'Save an HTTP(S) URL', security: mobileWriteSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url', 'project_id'], properties: { url: { type: 'string', format: 'uri' }, title: { type: 'string' }, project_id: { type: 'string' } } } } } }, responses: { ...mobileErrorResponses, 201: { description: 'URL saved' } } },
	},
	'/mobile/note-imports': {
		post: { tags: ['Mobile imports'], summary: 'Create a tenant/user/project-bound resumable upload', description: 'Rate-limited by session creation and concurrent active sessions. No total-byte ceiling.', security: mobileWriteSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['project_id', 'file_name', 'upload_length'], properties: { project_id: { type: 'string' }, file_name: { type: 'string' }, mime_type: { type: 'string' }, upload_length: { type: 'integer', format: 'int64', minimum: 0 }, title: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, example: { project_id: '64f0c3e72e62bd2ea6c41a10', file_name: 'research.pdf', mime_type: 'application/pdf', upload_length: 83000000 } } } } }, responses: { ...mobileErrorResponses, 201: { description: 'Upload session', headers: { Location: { schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'object', properties: { upload: { $ref: '#/components/schemas/MobileUploadSession' } } } } } }, 429: { description: 'Too many active imports' } } },
	},
	'/mobile/note-imports/{id}': {
		head: { tags: ['Mobile imports'], summary: 'Read the authoritative resume offset', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Current upload state', headers: { 'Upload-Offset': { schema: { type: 'integer', format: 'int64' } }, 'Upload-Length': { schema: { type: 'integer', format: 'int64' } }, 'Upload-State': { schema: { type: 'string' } }, 'Upload-Chunk-Size': { schema: { type: 'integer', enum: [20000000] } } } }, 404: { description: 'Session not found' } } },
		patch: { tags: ['Mobile imports'], summary: 'Append one integrity-checked chunk', description: 'Each non-final chunk must contain exactly 20,000,000 bytes; the final chunk contains the remaining bytes. PATCH requests are exempt from the request-count upload limiter. Exact retries are idempotent; overlaps conflict.', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'Upload-Offset', in: 'header', required: true, schema: { type: 'integer', format: 'int64' } }, { name: 'Upload-Length', in: 'header', required: true, schema: { type: 'integer', format: 'int64' } }, { name: 'Upload-Checksum', in: 'header', required: true, schema: { type: 'string', example: 'sha256 47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' } }], requestBody: { required: true, content: { 'application/offset+octet-stream': { schema: { type: 'string', format: 'binary', maxLength: 20000000 } } } }, responses: { 204: { description: 'Chunk accepted', headers: { 'Upload-Offset': { schema: { type: 'integer', format: 'int64' } } } }, 409: { description: 'Offset, overlap, chunk size, length, or state conflict' }, 413: { description: 'Chunk exceeds 20,000,000 bytes' }, 460: { description: 'SHA-256 checksum mismatch' }, 507: { description: 'Insufficient shared-volume storage' } } },
		get: { tags: ['Mobile imports'], summary: 'Get upload or extraction status', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'uploading, processing, complete, or failed status' } } },
		delete: { tags: ['Mobile imports'], summary: 'Cancel an import and remove temporary data', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Canceled' }, 409: { description: 'Import can no longer be canceled' } } },
	},
	'/mobile/note-imports/{id}/complete': {
		post: { tags: ['Mobile imports'], summary: 'Verify the complete upload and queue extraction', security: mobileWriteSecurity, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 202: { description: 'Extraction queued' }, 409: { description: 'Upload incomplete or invalid state' } } },
	},
	'/mobile/chat/stream': {
		post: { tags: ['Mobile AI'], summary: 'Stream a grounded AI answer as SSE', security: [{ MobileOAuth: ['ai:chat'] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, conversation_id: { type: 'string' }, project_id: { type: 'string' }, all_projects: { type: 'boolean' } } } } } }, responses: { 200: { description: 'SSE token, done, and error events', content: { 'text/event-stream': { schema: { type: 'string' } } } }, 403: { description: 'Insufficient ai:chat scope' }, 429: { description: 'AI daily limit reached' } } },
	},
	'/mobile/chat/conversations': {
		get: { tags: ['Mobile AI'], summary: 'List the signed-in user’s AI conversation history', security: [{ MobileOAuth: ['ai:chat'] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } }], responses: { ...mobileErrorResponses, 200: { description: 'Newest conversations first' } } },
	},
	'/mobile/chat/conversations/{id}/messages': {
		get: { tags: ['Mobile AI'], summary: 'Read one scoped AI conversation', security: [{ MobileOAuth: ['ai:chat'] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...mobileErrorResponses, 200: { description: 'Oldest-to-newest conversation messages' } } },
	},
	'/mobile/profile': {
		get: { tags: ['Mobile'], summary: 'Get the mobile profile', security: mobileReadSecurity, responses: { ...mobileErrorResponses, 200: { description: 'Profile' } } },
		put: { tags: ['Mobile'], summary: 'Update name, timezone, or time format', security: [{ MobileOAuth: ['profile:write'] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, timezone: { type: 'string', example: 'America/New_York' }, time_format: { type: 'string', enum: ['12-hour', '24-hour'] } } } } } }, responses: { ...mobileErrorResponses, 200: { description: 'Profile updated' } } },
	},
	'/mobile/socket-token': {
		post: { tags: ['Mobile'], summary: 'Issue a short-lived Socket.IO token', security: mobileReadSecurity, responses: { ...mobileErrorResponses, 200: { description: '15-minute token and refresh interval' } } },
	},
});

swaggerSpec.components.securitySchemes.ObsidianOAuth = {
	type: 'oauth2',
	description: 'OAuth 2.0 Authorization Code with PKCE for the first-party Streamient Sync Obsidian plugin.',
	flows: {
		authorizationCode: {
			authorizationUrl: '/oauth/authorize',
			tokenUrl: '/oauth/token',
			scopes: {
				'vault:read': 'Read vault connections, manifests, changes, and file content',
				'vault:write': 'Create connections and synchronize vault files',
			},
		},
	},
};

Object.assign(swaggerSpec.components.schemas, {
	ObsidianAccount: {
		type: 'object', required: ['id', 'name', 'user'],
		properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, user: { type: 'object', required: ['id', 'name', 'email'], properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' } } } },
	},
	ObsidianManifestEntry: {
		type: 'object', required: ['path', 'kind', 'size', 'sha256', 'modified_at', 'base_revision'],
		properties: { file_id: { type: 'string' }, path: { type: 'string' }, kind: { type: 'string' }, size: { type: 'integer', format: 'int64' }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, modified_at: { type: 'string', format: 'date-time' }, base_revision: { type: 'integer', minimum: 0 }, in_trash: { type: 'boolean' } },
	},
	ObsidianSyncScopePath: {
		type: 'object', required: ['path', 'kind'],
		properties: { path: { type: 'string' }, kind: { type: 'string', enum: ['file', 'folder'] } },
	},
	ObsidianSyncScope: {
		type: 'object', required: ['vault_mode'],
		properties: { vault_mode: { type: 'string', enum: ['off', 'selected', 'all'] }, selected_paths: { type: 'array', maxItems: 1000, items: { $ref: '#/components/schemas/ObsidianSyncScopePath' } }, excluded_paths: { type: 'array', maxItems: 1000, items: { $ref: '#/components/schemas/ObsidianSyncScopePath' } } },
	},
	ObsidianMutation: {
		type: 'object', required: ['operation_id', 'operation', 'path', 'base_revision', 'modified_at', 'device_id'],
		properties: { operation_id: { type: 'string' }, operation: { type: 'string', enum: ['create', 'update', 'rename', 'trash', 'restore'] }, file_id: { type: 'string' }, path: { type: 'string' }, previous_path: { type: 'string' }, base_revision: { type: 'integer', minimum: 0 }, modified_at: { type: 'string', format: 'date-time' }, upload_id: { type: 'string' }, device_id: { type: 'string' } },
	},
	ObsidianChange: {
		type: 'object', required: ['sequence', 'file_id', 'operation', 'path', 'revision', 'sha256', 'modified_at', 'source'],
		properties: { connection_id: { type: 'string' }, sequence: { type: 'integer', format: 'int64' }, file_id: { type: 'string' }, operation: { type: 'string', enum: ['create', 'update', 'rename', 'trash', 'restore'] }, path: { type: 'string' }, previous_path: { type: 'string', nullable: true }, revision: { type: 'integer' }, sha256: { type: 'string' }, modified_at: { type: 'string', format: 'date-time' }, source: { type: 'string', enum: ['obsidian', 'streamient'] }, device_id: { type: 'string', nullable: true }, conflict: { type: 'boolean' }, conflict_reason: { type: 'string', nullable: true }, losing_revision_id: { type: 'string', nullable: true }, revision_download_url: { type: 'string', nullable: true }, download_url: { type: 'string', nullable: true } },
	},
	ObsidianUpload: {
		type: 'object', required: ['id', 'connection_id', 'path', 'upload_length', 'upload_offset', 'chunk_size', 'sha256', 'state'],
		properties: { id: { type: 'string' }, connection_id: { type: 'string' }, path: { type: 'string' }, mime_type: { type: 'string' }, upload_length: { type: 'integer', format: 'int64' }, upload_offset: { type: 'integer', format: 'int64' }, chunk_size: { type: 'integer', enum: [20000000] }, sha256: { type: 'string' }, state: { type: 'string', enum: ['uploading', 'complete', 'failed', 'canceled'] }, blob_id: { type: 'string', nullable: true }, error: { type: 'string', nullable: true } },
	},
});

const obsidianReadSecurity = [{ ObsidianOAuth: ['vault:read'] }];
const obsidianWriteSecurity = [{ ObsidianOAuth: ['vault:write'] }];
const obsidianErrors = { 400: { description: 'Invalid sync request' }, 401: { description: 'Missing or expired OAuth token' }, 403: { description: 'Feature disabled, Pro required, or insufficient scope' }, 404: { description: 'Connection, upload, or file not found' }, 409: { description: 'Revision, checksum, path, offset, or state conflict' }, 503: { description: 'Obsidian encryption is not configured' } };

Object.assign(swaggerSpec.paths, {
	'/obsidian/account': { get: { tags: ['Obsidian Sync'], summary: 'Identify the account and user authorized by this token', security: obsidianReadSecurity, responses: { ...obsidianErrors, 200: { description: 'Authorized account identity', content: { 'application/json': { schema: { type: 'object', properties: { account: { $ref: '#/components/schemas/ObsidianAccount' } } } } } } } } },
	'/obsidian/projects': { get: { tags: ['Obsidian Sync'], summary: 'List projects available to the plugin', security: obsidianReadSecurity, responses: { ...obsidianErrors, 200: { description: 'Active projects' } } } },
	'/obsidian/connections': {
		get: { tags: ['Obsidian Sync'], summary: 'List vault connections', security: obsidianReadSecurity, parameters: [{ name: 'project_id', in: 'query', schema: { type: 'string' } }], responses: { ...obsidianErrors, 200: { description: 'Vault connections' } } },
		post: { tags: ['Obsidian Sync'], summary: 'Create or join the project vault connection', security: obsidianWriteSecurity, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['project_id', 'device_id'], properties: { project_id: { type: 'string' }, name: { type: 'string' }, streamient_folder: { type: 'string', default: 'Streamient' }, device_id: { type: 'string' }, device_name: { type: 'string' }, platform: { type: 'string', enum: ['desktop', 'mobile'] } } } } } }, responses: { ...obsidianErrors, 201: { description: 'Connection created or joined' } } },
	},
	'/obsidian/connections/{connectionId}': {
		patch: { tags: ['Obsidian Sync'], summary: 'Enable, disconnect, or configure a connection', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' }, name: { type: 'string' }, streamient_folder: { type: 'string' } } } } } }, responses: { ...obsidianErrors, 200: { description: 'Updated connection' } } },
		delete: { tags: ['Obsidian Sync'], summary: 'Remove a connection, encrypted mirror, attachments, and history while retaining Notes, Memories, and URLs', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...obsidianErrors, 200: { description: 'Connection removed and projected knowledge retained' } } },
	},
	'/obsidian/connections/{connectionId}/devices': { post: { tags: ['Obsidian Sync'], summary: 'Register or refresh a device', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...obsidianErrors, 200: { description: 'Updated device list' } } } },
	'/obsidian/connections/{connectionId}/request-sync': { post: { tags: ['Obsidian Sync'], summary: 'Request a full sync from online plugin devices', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...obsidianErrors, 202: { description: 'Sync requested' } } } },
	'/obsidian/connections/{connectionId}/manifest': { post: { tags: ['Obsidian Sync'], summary: 'Upload or reconcile a batched scoped-vault manifest', description: 'Send up to 500 files per numbered batch with complete=false, then finalize the manifest_id with batch_count and complete=true. Preview finalization is non-mutating. Omit scope for legacy full-vault behavior. Finalization materializes at most 25 pending project exports and sets exports_pending when more remain.', security: [{ ObsidianOAuth: ['vault:read', 'vault:write'] }], parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { manifest_id: { type: 'string' }, batch_index: { type: 'integer', minimum: 0, maximum: 199 }, batch_count: { type: 'integer', minimum: 0, maximum: 200 }, complete: { type: 'boolean' }, preview: { type: 'boolean' }, summary_only: { type: 'boolean', description: 'Return only aggregate action counts and bytes during preview.' }, scope: { $ref: '#/components/schemas/ObsidianSyncScope' }, files: { type: 'array', maxItems: 500, items: { $ref: '#/components/schemas/ObsidianManifestEntry' } }, device_id: { type: 'string' }, device_name: { type: 'string' }, platform: { type: 'string' } } } } } }, responses: { ...obsidianErrors, 200: { description: 'Batch acknowledgement or final scoped actions, aggregate summary, and export continuation state' } } } },
	'/obsidian/connections/{connectionId}/exports': { post: { tags: ['Obsidian Sync'], summary: 'Materialize the next bounded batch of project exports', description: 'Creates at most 25 pending Note, Memory, or URL Markdown exports. Repeat while has_more is true.', security: [{ ObsidianOAuth: ['vault:read', 'vault:write'] }], parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { ...obsidianErrors, 200: { description: 'Download actions, aggregate summary, cursor, and continuation state' } } } },
	'/obsidian/connections/{connectionId}/relocate': { post: { tags: ['Obsidian Sync'], summary: 'Move the managed project folder in resumable batches', description: 'Moves at most 50 synchronized paths per call while retaining content and history. Repeat while has_more is true.', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['streamient_folder'], properties: { streamient_folder: { type: 'string' }, device_id: { type: 'string' }, device_name: { type: 'string' }, platform: { type: 'string' } } } } } }, responses: { ...obsidianErrors, 200: { description: 'Rename changes, moved and remaining counts, connection, and continuation state' } } } },
	'/obsidian/connections/{connectionId}/mutations': { post: { tags: ['Obsidian Sync'], summary: 'Apply up to 100 idempotent file mutations', security: obsidianWriteSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mutations'], properties: { mutations: { type: 'array', minItems: 1, maxItems: 100, items: { $ref: '#/components/schemas/ObsidianMutation' } } } } } } }, responses: { ...obsidianErrors, 200: { description: 'Accepted, duplicate, or newest-wins conflict outcomes' } } } },
	'/obsidian/connections/{connectionId}/changes': { get: { tags: ['Obsidian Sync'], summary: 'Read ordered changes after a cursor', security: obsidianReadSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'after', in: 'query', schema: { type: 'integer', format: 'int64', minimum: 0 } }, { name: 'device_id', in: 'query', schema: { type: 'string' } }], responses: { ...obsidianErrors, 200: { description: 'Ordered changes and next cursor', content: { 'application/json': { schema: { type: 'object', properties: { changes: { type: 'array', items: { $ref: '#/components/schemas/ObsidianChange' } }, cursor: { type: 'integer', format: 'int64' }, has_more: { type: 'boolean' }, sync_requested_at: { type: 'string', format: 'date-time', nullable: true } } } } } } } } },
	'/obsidian/connections/{connectionId}/conflicts': { get: { tags: ['Obsidian Sync'], summary: 'List newest-wins conflicts and recoverable revision URLs', security: obsidianReadSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 250 } }], responses: { ...obsidianErrors, 200: { description: 'Newest conflicts first' } } } },
	'/obsidian/connections/{connectionId}/resolve': { post: { tags: ['Obsidian Sync'], summary: 'Resolve Obsidian wiki links and embeds', security: obsidianReadSecurity, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { paths: { type: 'array', maxItems: 100, items: { type: 'string' } } } } } } }, responses: { ...obsidianErrors, 200: { description: 'Resolved file, Note, Memory, and download targets' } } } },
	'/obsidian/uploads': { post: { tags: ['Obsidian Sync uploads'], summary: 'Create an encrypted resumable upload', security: obsidianWriteSecurity, responses: { ...obsidianErrors, 201: { description: 'Upload session', content: { 'application/json': { schema: { type: 'object', properties: { upload: { $ref: '#/components/schemas/ObsidianUpload' } } } } } }, 413: { description: 'File exceeds configured limit' }, 429: { description: 'Too many active uploads' } } } },
	'/obsidian/uploads/{id}': { head: { tags: ['Obsidian Sync uploads'], summary: 'Read upload offset', security: obsidianWriteSecurity, responses: { 204: { description: 'Upload headers' }, 404: { description: 'Upload not found' } } }, get: { tags: ['Obsidian Sync uploads'], summary: 'Get upload status', security: obsidianWriteSecurity, responses: { ...obsidianErrors, 200: { description: 'Upload session' } } }, patch: { tags: ['Obsidian Sync uploads'], summary: 'Append one encrypted integrity-checked chunk', security: obsidianWriteSecurity, requestBody: { required: true, content: { 'application/offset+octet-stream': { schema: { type: 'string', format: 'binary', maxLength: 20000000 } } } }, responses: { ...obsidianErrors, 204: { description: 'Chunk accepted' }, 413: { description: 'Chunk too large' }, 507: { description: 'Insufficient storage' } } }, delete: { tags: ['Obsidian Sync uploads'], summary: 'Cancel an upload', security: obsidianWriteSecurity, responses: { ...obsidianErrors, 200: { description: 'Canceled upload' } } } },
	'/obsidian/uploads/{id}/complete': { post: { tags: ['Obsidian Sync uploads'], summary: 'Verify and finalize the encrypted blob', security: obsidianWriteSecurity, responses: { ...obsidianErrors, 200: { description: 'Completed upload' } } } },
	'/obsidian/files/{id}': { get: { tags: ['Obsidian Sync'], summary: 'Get synchronized file metadata', security: obsidianReadSecurity, responses: { ...obsidianErrors, 200: { description: 'File metadata' } } } },
	'/obsidian/files/{id}/content': { get: { tags: ['Obsidian Sync'], summary: 'Stream decrypted synchronized file content', security: obsidianReadSecurity, responses: { ...obsidianErrors, 200: { description: 'File bytes', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } } } },
	'/obsidian/revisions/{id}/content': { get: { tags: ['Obsidian Sync'], summary: 'Download a recoverable losing conflict revision before its 30-day expiry', security: obsidianReadSecurity, responses: { ...obsidianErrors, 200: { description: 'Revision bytes', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } } } },
});

swaggerSpec.components.schemas.AccountDeletionState = {
	type: 'object', nullable: true, properties: { requested_at: { type: 'string', format: 'date-time' }, stage: { type: 'string' }, error: { type: 'string' }, job_id: { type: 'string' } },
};
swaggerSpec.paths['/account/deletion'] = {
	parameters: [{ name: 'host_id', in: 'query', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
	get: {
		tags: ['Account'], summary: 'Preview permanent account deletion', operationId: 'previewAccountDeletion', security: [{ BrowserSession: [] }],
		description: 'Hosted owner session and explicit account context required. Checks live Stripe subscriptions and schedules. Returns a session-bound confirmation token valid for ten minutes. Impersonation and bearer tokens are rejected.',
		responses: {
			200: { description: 'Eligible account and confirmation token', content: { 'application/json': { schema: { type: 'object', required: ['host_id', 'name', 'eligible', 'confirmation_token'], properties: { host_id: { type: 'string' }, name: { type: 'string' }, eligible: { type: 'boolean' }, confirmation_token: { type: 'string' }, deletion: { $ref: '#/components/schemas/AccountDeletionState' } } } } } },
			400: { description: 'Explicit account context required' }, 403: { description: 'Owner browser session required' }, 409: { description: 'Subscription not fully canceled' }, 503: { description: 'Billing could not be verified' },
		},
	},
	post: {
		tags: ['Account'], summary: 'Request permanent account deletion', operationId: 'requestAccountDeletion', security: [{ BrowserSession: [] }],
		description: 'Checks billing again, durably locks the host, revokes access, and schedules retryable cleanup. Duplicate requests reuse the same task. Retains access to other accounts and billing history. Original external sources remain.',
		requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['confirmation', 'confirmation_token'], properties: { confirmation: { type: 'string', enum: ['DELETE'] }, confirmation_token: { type: 'string' } } } } } },
		responses: {
			202: { description: 'Deletion accepted, not yet completed', content: { 'application/json': { schema: { type: 'object', properties: { host_id: { type: 'string' }, deletion: { $ref: '#/components/schemas/AccountDeletionState' }, message: { type: 'string' }, redirect_to: { type: 'string' } } } } } },
			400: { description: 'Confirmation must be DELETE' }, 403: { description: 'Invalid owner session, context, or confirmation token' }, 409: { description: 'Subscription not fully canceled' }, 503: { description: 'Billing could not be verified' },
		},
	},
};
Object.assign(swaggerSpec.paths['/admin/api/accounts/{tenantId}'].delete, {
	description: 'Durably locks the host and schedules the same verified background cleanup used by account owners. Requires fully canceled paid subscriptions. Retains Stripe billing history.',
	requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['confirmation'], properties: { confirmation: { type: 'string', enum: ['DELETE'] } } } } } },
	responses: { 202: { description: 'Deletion accepted' }, 400: { description: 'Confirmation required' }, 403: { description: 'Admin session required' }, 404: { description: 'Account not found' }, 409: { description: 'Subscription not canceled' }, 503: { description: 'Billing could not be verified' } },
});
swaggerSpec.paths['/admin/api/accounts/{tenantId}/deletion'] = {
	servers: [{ url: '/' }], parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
	get: { tags: ['Admin'], summary: 'Get account deletion progress', operationId: 'getAccountDeletionStatus', security: [{ AdminSession: [] }], responses: { 200: { description: 'Deletion state, including complete when the host no longer exists' }, 403: { description: 'Admin session required' } } },
};
swaggerSpec.paths['/admin/api/accounts/{tenantId}/deletion/retry'] = {
	servers: [{ url: '/' }], parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
	post: { tags: ['Admin'], summary: 'Retry a failed account deletion', operationId: 'retryAccountDeletion', security: [{ AdminSession: [] }], responses: { 202: { description: 'Existing deletion task requeued' }, 403: { description: 'Admin session required' }, 409: { description: 'No failed deletion to retry' } } },
};


if (swaggerSpec.components.schemas.AdminAccount?.allOf) swaggerSpec.components.schemas.AdminAccount.allOf.push({ type: 'object', properties: { deletion: { $ref: '#/components/schemas/AccountDeletionState' } } });
export default swaggerSpec;
