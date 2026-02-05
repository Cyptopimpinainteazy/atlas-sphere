"""WebSocket server for swarm events: subscribes to NATS events and broadcasts to WS clients."""
import asyncio
import json
import logging
import os
import websockets
from websockets.exceptions import ConnectionClosed

logging.basicConfig(level=logging.INFO)

# optional: use nats
try:
    import nats
    use_nats = True
except ImportError as e:
    logging.warning(f"NATS library not available: {e}")
except ImportError:
    use_nats = False
    print("NATS module not available - WebSocket server will run without NATS integration")

# Set of connected WS clients
connected_clients = set()

async def nats_consumer():
    """Subscribe to NATS events and broadcast to WS clients."""
    if not use_nats:
        logging.info("NATS not available, skipping NATS consumer")
        return
    nc = await nats.connect(servers=[os.environ.get('NATS_URL', 'nats://127.0.0.1:4222')])
    logging.info("Connected to NATS")

    async def message_handler(msg):
        try:
            data = json.loads(msg.data.decode('utf-8'))
            # Broadcast to all connected WS clients
            if connected_clients:
                message = json.dumps(data)
                await asyncio.gather(
                    *[client.send(message) for client in connected_clients],
                    return_exceptions=True
                )
        except Exception as e:
            logging.error(f"Error handling NATS message: {e}")

    await nc.subscribe("events", cb=message_handler)
    logging.info("Subscribed to NATS events topic")

async def ws_handler(websocket, path):
    """Handle WS connections."""
    connected_clients.add(websocket)
    logging.info(f"WS client connected: {len(connected_clients)} total")
    try:
        await websocket.wait_closed()
    except ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        logging.info(f"WS client disconnected: {len(connected_clients)} remaining")

async def main():
    """Start WS server and NATS consumer."""
    ws_port = int(os.environ.get('WS_PORT', 8787))
    ws_server = await websockets.serve(ws_handler, "0.0.0.0", ws_port)
    logging.info(f"WS server started on port {ws_port}")

    # Start NATS consumer
    await nats_consumer()

    # Keep running
    await ws_server.wait_closed()

if __name__ == '__main__':
    asyncio.run(main())