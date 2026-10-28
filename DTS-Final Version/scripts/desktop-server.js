'use strict';

// Emit the server's existing shutdown signal to close SQLite cleanly on Windows.
// The input pipe also closes if the owning desktop launcher exits unexpectedly.
require('../server.js');
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  process.emit('SIGTERM');
}
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  const lines = input.split(/\r?\n/);
  input = lines.pop();
  if (lines.some(line => line.trim() === 'stop')) stop();
});
process.stdin.on('end', stop);
process.stdin.on('error', stop);
process.stdin.resume();
