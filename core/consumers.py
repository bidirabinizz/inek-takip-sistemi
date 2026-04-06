import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SensorDataConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer - Canlı sensör verilerini frontend'e gönderir.
    """

    async def connect(self):
        await self.channel_layer.group_add("sensor_data", self.channel_name)
        await self.accept()
        print("[WebSocket] Yeni bağlantı kabul edildi.")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("sensor_data", self.channel_name)
        print(f"[WebSocket] Bağlantı kapatıldı. Kod: {close_code}")

    async def sensor_data_update(self, event):
        # WebSocket'e mesaj gönder
        await self.send(text_data=json.dumps(event))
