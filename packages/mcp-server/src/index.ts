#!/usr/bin/env node
/**
 * GuitarPulse MCP server: the theory engine, licks vault, improv metrics and practice planner.
 * Serves stdio by default (Claude Desktop, Claude Code); Streamable HTTP when TRANSPORT=http.
 */
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, SERVER_NAME } from './server.js';

if (process.env.TRANSPORT === 'http') {
  const handler = createMcpHandler(createServer);
  const app = createMcpExpressApp(); // JSON body parsing plus Host/Origin checks for localhost
  const nodeHandler = toNodeHandler(handler);
  app.all('/mcp', (req, res) => void nodeHandler(req, res, req.body));
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '127.0.0.1', () => console.error(`${SERVER_NAME} listening on http://127.0.0.1:${port}/mcp`));
} else {
  serveStdio(createServer);
  console.error(`${SERVER_NAME} running on stdio`);
}
