/**
 * SharedWorker — Agent Message Bus
 * Ultra-low latency (<1ms) cross-agent communication.
 * All agents connect to this single shared worker.
 * Messages are routed by agent ID — point-to-point or broadcast.
 */
const ports    = new Map(); // agentId → MessagePort
const channels = new Map(); // channelId → Set of agentIds

self.onconnect = (event) => {
  const port = event.ports[0];
  let agentId = null;

  port.onmessage = (e) => {
    const { type, from, to, channel, payload } = e.data;

    switch (type) {
      case "register":
        agentId = from;
        ports.set(agentId, port);
        // Notify all that a new agent joined
        broadcast({ type: "agent:joined", from: agentId, payload: { agentId } }, agentId);
        port.postMessage({ type: "registered", agentId });
        break;

      case "send":
        // Point-to-point
        if (to && ports.has(to)) {
          ports.get(to).postMessage({ type: "message", from, payload, ts: Date.now() });
        }
        break;

      case "broadcast":
        broadcast({ type: "broadcast", from, payload, ts: Date.now() }, from);
        break;

      case "channel:join":
        if (!channels.has(channel)) channels.set(channel, new Set());
        channels.get(channel).add(from);
        port.postMessage({ type: "channel:joined", channel });
        break;

      case "channel:send":
        if (channels.has(channel)) {
          const members = channels.get(channel);
          for (const memberId of members) {
            if (memberId !== from && ports.has(memberId)) {
              ports.get(memberId).postMessage({ type: "channel:message", from, channel, payload, ts: Date.now() });
            }
          }
        }
        break;

      case "ping":
        port.postMessage({ type: "pong", ts: Date.now() });
        break;

      case "list_agents":
        port.postMessage({ type: "agent_list", agents: Array.from(ports.keys()) });
        break;
    }
  };

  port.onmessageerror = () => {
    if (agentId) {
      ports.delete(agentId);
      broadcast({ type: "agent:left", from: agentId, payload: { agentId } }, agentId);
    }
  };

  port.start();
};

function broadcast(msg, excludeId) {
  for (const [id, p] of ports) {
    if (id !== excludeId) p.postMessage(msg);
  }
}
