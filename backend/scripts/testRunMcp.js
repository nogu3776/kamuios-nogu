#!/usr/bin/env node
const { runMcpJob } = require('../services/mcpJobRunner');

async function main() {
  const serverId = process.argv[2];
  if (!serverId) {
    console.error('Usage: node backend/scripts/testRunMcp.js <server-id>');
    process.exit(1);
  }
  const prompt = process.argv.slice(3).join(' ') || 'Test prompt';
  try {
    const result = await runMcpJob({ serverId, prompt });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
