import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class SensorDataConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer - Canlı sensör verilerini frontend'e gönderir.
    """

    async def connect(self):
        # WebSocket grubuna katıl
        self.group_name = 'sensor_data'
        
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        print("[WebSocket] Yeni bağlantı kabul edildi.")

    async def disconnect(self, close_code):
        # WebSocket grubundan ayrıl
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        print(f"[WebSocket] Bağlantı kapatıldı. Kod: {close_code}")

    async def receive(self, text_data):
        """
        Frontend'den gelen mesajları işle (şu an kullanılmıyor).
        """
        try:
            data = json.loads(text_data)
            print(f"[WebSocket] Gelen mesaj: {data}")
        except json.JSONDecodeError:
            print("[WebSocket] Geçersiz JSON alındı.")

    async def sensor_data_update(self, event):
        """
        Backend'den gelen sensör verisi güncellemesini frontend'e gönder.
        Bu metod, channel_layer.group_send() ile çağrılır.
        """
        sensor_data = event.get('data', {})
        
        await self.send(text_data=json.dumps({
            'type': 'sensor_update',
            'data': sensor_data
        }))