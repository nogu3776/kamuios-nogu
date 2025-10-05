const { PROTOCOL_VERSION, AUTH_TOKEN } = require('./config');

/**
 * MCPセッションを作成
 */
async function createSession(serverUrl) {
    const headers = { 'Content-Type': 'application/json' };
    if (AUTH_TOKEN) headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer ')
        ? AUTH_TOKEN
        : `Bearer ${AUTH_TOKEN}`;

    const initPayload = {
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: process.env.KAMUI_CODE_CLIENT_NAME || 'kamuios-image-remix',
                version: '1.0.0'
            }
        }
    };

    const res = await fetch(serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(initPayload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to initialize MCP session (${res.status}): ${text}`);
    }

    const sessionId = res.headers.get('mcp-session-id');
    if (!sessionId) {
        throw new Error('MCP session id was not provided by the server');
    }

    return {
        serverUrl,
        headers,
        sessionId
    };
}

/**
 * MCPツールを呼び出し
 */
async function callTool(session, toolName, args) {
    const headers = {
        ...session.headers,
        'Mcp-Session-Id': session.sessionId,
        'MCP-Protocol-Version': PROTOCOL_VERSION
    };

    const body = {
        jsonrpc: '2.0',
        id: `call-${toolName}`,
        method: 'tools/call',
        params: {
            name: toolName,
            arguments: args
        }
    };

    const res = await fetch(session.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`MCP tool call failed (${res.status}): ${text}`);
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        throw new Error(`Failed to parse MCP response JSON: ${err.message}`);
    }

    if (json.error) {
        throw new Error(`MCP error: ${json.error.message || 'Unknown error'}`);
    }

    const content = Array.isArray(json.result?.content)
        ? json.result.content.map((item) => (item.text || '')).join('\n')
        : '';

    return {
        raw: json,
        text: content
    };
}

module.exports = {
    createSession,
    callTool
};
