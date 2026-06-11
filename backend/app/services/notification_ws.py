"""
In-memory WebSocket connection manager for notification delivery.

This is intentionally lightweight and works for a single API process. Use Redis
pub/sub or a managed broker before scaling to multiple workers.
"""

import uuid
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class NotificationConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].append(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets and user_id in self._connections:
            del self._connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in self._connections.get(user_id, []):
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            self.disconnect(user_id, websocket)


notification_ws_manager = NotificationConnectionManager()
