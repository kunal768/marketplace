#!/usr/bin/env node

/**
 * Real-time Chat Testing Script
 * Tests WebSocket connections, message delivery, and presence refresh
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const EVENTS_SERVER_URL = process.env.EVENTS_SERVER_URL || 'ws://localhost:8001/ws';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8080';

// Test users (you'll need to provide real tokens)
const USER1 = {
  userId: process.env.TEST_USER1_ID || 'user1-id',
  token: process.env.TEST_USER1_TOKEN || '',
  refreshToken: process.env.TEST_USER1_REFRESH_TOKEN || '',
};

const USER2 = {
  userId: process.env.TEST_USER2_ID || 'user2-id',
  token: process.env.TEST_USER2_TOKEN || '',
  refreshToken: process.env.TEST_USER2_REFRESH_TOKEN || '',
};

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function test(name, fn) {
  return new Promise((resolve) => {
    log(`Testing: ${name}`, 'info');
    fn()
      .then(() => {
        testsPassed++;
        testResults.push({ name, status: 'PASSED' });
        log(`PASSED: ${name}`, 'success');
        resolve();
      })
      .catch((error) => {
        testsFailed++;
        testResults.push({ name, status: 'FAILED', error: error.message });
        log(`FAILED: ${name} - ${error.message}`, 'error');
        resolve();
      });
  });
}

function createWebSocketClient(user, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(EVENTS_SERVER_URL);
    const messages = [];
    const notifications = [];
    let connected = false;

    ws.on('open', () => {
      log(`${name}: WebSocket opened, sending auth...`);
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.userId,
        token: user.token,
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth_ack') {
          if (message.status === 'success') {
            connected = true;
            log(`${name}: Authenticated successfully`, 'success');
            resolve({ ws, messages, notifications, connected: () => connected });
          } else {
            reject(new Error(`Auth failed: ${message.error}`));
          }
        } else if (message.type === 'message') {
          messages.push(message);
          log(`${name}: Received message: ${message.data.content}`, 'success');
        } else if (message.type === 'notification') {
          notifications.push(message);
          log(`${name}: Received notification: ${message.subType} (count: ${message.count})`);
        }
      } catch (error) {
        log(`${name}: Failed to parse message: ${error.message}`, 'error');
      }
    });

    ws.on('error', (error) => {
      log(`${name}: WebSocket error: ${error.message}`, 'error');
      reject(error);
    });

    ws.on('close', () => {
      connected = false;
      log(`${name}: WebSocket closed`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connected) {
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

function sendChatMessage(ws, recipientId, content) {
  return new Promise((resolve, reject) => {
    const message = {
      type: 'chat',
      recipientId,
      msg: content,
    };
    
    ws.send(JSON.stringify(message));
    log(`Sending message to ${recipientId}: ${content}`);
    
    // Wait a bit for delivery
    setTimeout(() => resolve(), 1000);
  });
}

async function runTests() {
  log('Starting Real-time Chat Tests', 'info');
  log('='.repeat(60));

  let client1, client2;

  // Test 1: Connect User 1
  await test('User 1 WebSocket Connection', async () => {
    if (!USER1.token) {
      throw new Error('USER1_TOKEN not provided. Set TEST_USER1_TOKEN environment variable.');
    }
    client1 = await createWebSocketClient(USER1, 'User1');
    if (!client1.connected()) {
      throw new Error('User 1 not connected');
    }
  });

  // Test 2: Connect User 2
  await test('User 2 WebSocket Connection', async () => {
    if (!USER2.token) {
      throw new Error('USER2_TOKEN not provided. Set TEST_USER2_TOKEN environment variable.');
    }
    client2 = await createWebSocketClient(USER2, 'User2');
    if (!client2.connected()) {
      throw new Error('User 2 not connected');
    }
  });

  // Test 3: User 1 sends message to User 2
  await test('User 1 -> User 2 Message Delivery', async () => {
    const testMessage = `Test message at ${new Date().toISOString()}`;
    await sendChatMessage(client1.ws, USER2.userId, testMessage);
    
    // Wait for message to be delivered
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const received = client2.messages.find(m => 
      m.data && m.data.content === testMessage
    );
    
    if (!received) {
      throw new Error(`Message not received by User 2. Received messages: ${client2.messages.length}`);
    }
  });

  // Test 4: User 2 sends message to User 1
  await test('User 2 -> User 1 Message Delivery', async () => {
    const testMessage = `Reply message at ${new Date().toISOString()}`;
    await sendChatMessage(client2.ws, USER1.userId, testMessage);
    
    // Wait for message to be delivered
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const received = client1.messages.find(m => 
      m.data && m.data.content === testMessage
    );
    
    if (!received) {
      throw new Error(`Message not received by User 1. Received messages: ${client1.messages.length}`);
    }
  });

  // Test 5: Presence refresh (wait and verify connection still works)
  await test('Presence Refresh (Long Connection)', async () => {
    log('Waiting 20 seconds to test presence refresh...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    if (!client1.connected() || !client2.connected()) {
      throw new Error('Connection lost during presence refresh test');
    }
    
    // Send another message to verify presence is still active
    const testMessage = `Post-refresh message at ${new Date().toISOString()}`;
    await sendChatMessage(client1.ws, USER2.userId, testMessage);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const received = client2.messages.find(m => 
      m.data && m.data.content === testMessage
    );
    
    if (!received) {
      throw new Error('Message not delivered after presence refresh period');
    }
  });

  // Test 6: Multiple rapid messages
  await test('Multiple Rapid Messages', async () => {
    const messages = [];
    for (let i = 0; i < 5; i++) {
      const msg = `Rapid message ${i} at ${new Date().toISOString()}`;
      messages.push(msg);
      await sendChatMessage(client1.ws, USER2.userId, msg);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const receivedCount = messages.filter(msg => 
      client2.messages.some(m => m.data && m.data.content === msg)
    ).length;
    
    if (receivedCount < 5) {
      throw new Error(`Only received ${receivedCount}/5 rapid messages`);
    }
  });

  // Cleanup
  log('Closing connections...');
  if (client1) client1.ws.close();
  if (client2) client2.ws.close();

  // Print results
  log('='.repeat(60));
  log(`Tests Completed: ${testsPassed + testsFailed}`, 'info');
  log(`Passed: ${testsPassed}`, 'success');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'error' : 'info');
  
  if (testsFailed > 0) {
    log('\nFailed Tests:', 'error');
    testResults
      .filter(t => t.status === 'FAILED')
      .forEach(t => log(`  - ${t.name}: ${t.error}`, 'error'));
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});

