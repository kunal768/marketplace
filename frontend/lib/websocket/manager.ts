// Global WebSocket manager to allow disconnecting WebSocket from anywhere (e.g., logout)
let globalWebSocketDisconnect: (() => void) | null = null

export function setGlobalWebSocketDisconnect(disconnect: () => void) {
  globalWebSocketDisconnect = disconnect
}

export function clearGlobalWebSocketDisconnect() {
  globalWebSocketDisconnect = null
}

export function disconnectGlobalWebSocket() {
  if (globalWebSocketDisconnect) {
    console.log('[WebSocketManager] Disconnecting WebSocket via global disconnect')
    globalWebSocketDisconnect()
  }
}

