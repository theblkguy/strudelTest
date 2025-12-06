const OSC = require('osc-js')
const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

console.log('Starting Strudel OSC Bridge...')

// Create HTTP server for serving HTML files
const httpServer = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

httpServer.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
  console.log('Open http://localhost:3000 in your browser');
});

// Create WebSocket server for browser connections
const wss = new WebSocket.Server({ port: 8080 })
console.log('WebSocket server listening on port 8080')

// Track connected clients
let connectedClients = []

wss.on('connection', (ws) => {
  console.log('Browser connected to WebSocket')
  connectedClients.push(ws)
  
  // Send welcome message
  ws.send(JSON.stringify({
    address: '/system/connected',
    args: [1]
  }))
  
  ws.on('close', () => {
    console.log('Browser disconnected')
    connectedClients = connectedClients.filter(client => client !== ws)
  })
})

// Create OSC server to receive from Unreal
const config = {
  type: 'udp4',
  open: {
    host: '127.0.0.1',
    port: 9000
  }
}

const osc = new OSC({ plugin: new OSC.DatagramPlugin(config) })

osc.on('open', () => {
  console.log('OSC server listening on port 9000 (waiting for Unreal...)')
})

osc.on('*', (message) => {
  console.log(`Received OSC: ${message.address} [${message.args.join(', ')}]`)
  
  // Convert OSC message to JSON for WebSocket
  const webSocketMessage = {
    address: message.address,
    args: message.args
  }
  
  // Broadcast to all connected browsers
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(webSocketMessage))
    }
  })
})

// Start OSC server
osc.open()

console.log('')
console.log('Bridge ready!')
console.log('Next steps:')
console.log('   1. Open http://localhost:3000 in your browser')
console.log('   2. Click "Start Audio" to enable Strudel background music')
console.log('   3. Test WebSocket connection')
console.log('   4. Send OSC messages from Unreal Engine to localhost:9000')
console.log('')
console.log('Press Ctrl+C to stop')

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down bridge...')
  osc.close()
  wss.close()
  httpServer.close()
  process.exit(0)
})