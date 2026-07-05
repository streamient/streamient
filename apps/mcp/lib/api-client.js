/**
 * API client for MCP server to communicate with the main Streamient app.
 */
export class ApiClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.auth = typeof token === 'string'
      ? { scheme: 'Token', token }
      : { scheme: token?.scheme || 'Token', token: token?.token || '' };
    this.mcpClient = null;
  }

  setMcpClient(clientInfo) {
    this.mcpClient = clientInfo;
  }

  async request(method, path, body) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `${this.auth.scheme} ${this.auth.token}`,
    };
    if (this.mcpClient) headers['X-MCP-Client'] = this.mcpClient;
    const options = { method, headers, signal: AbortSignal.timeout(30000) };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${method} ${path} failed (${response.status}): ${err}`);
    }

    return response.json();
  }

  get(path) {
    return this.request('GET', path);
  }
  post(path, body) {
    return this.request('POST', path, body);
  }
  put(path, body) {
    return this.request('PUT', path, body);
  }
  delete(path) {
    return this.request('DELETE', path);
  }
}
