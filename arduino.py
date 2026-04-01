import serial
import requests
import time
import sys
import threading
from collections import deque

# ─────────────────────────────────────────────
#  AYARLAR
# ─────────────────────────────────────────────
SERIAL_PORT    = 'COM6'
BAUD_RATE      = 115200
API_URL        = "http://127.0.0.1:8000/api/gercek-sensor/" # Windows Localhost
BATCH_SIZE     = 60
MIN_MAG        = 0.5   # Hareket eşiği

# ─────────────────────────────────────────────
#  YAPI
# ─────────────────────────────────────────────
data_queue  = deque()
queue_lock  = threading.Lock()
print_lock  = threading.Lock()
stop_event  = threading.Event()

session = requests.Session()
stats = {"parse_errors": 0, "filtered": 0, "sent_batches": 0}

def tprint(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

# ─────────────────────────────────────────────
#  THREAD 1 — Serial Okuyucu (ADXL Odaklı)
# ─────────────────────────────────────────────
def serial_reader(ser):
    while not stop_event.is_set():
        try:
            if ser.in_waiting == 0:
                time.sleep(0.002)
                continue

            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line: continue

            # Veriyi parçala (Gelen satırda en az 3 değer -x,y,z- olmalı)
            parts = line.split(',')
            if len(parts) < 3: continue

            try:
                # Sadece ilk 3 değeri (ADXL) alıyoruz
                vals = [float(p) for p in parts[:3]]
                mag = (vals[0]**2 + vals[1]**2 + vals[2]**2) ** 0.5

                # Filtre: Sadece ADXL verisi MIN_MAG'dan büyükse al
                if mag < MIN_MAG:
                    stats["filtered"] += 1
                    continue

                payload = {
                    "mac": "ADXL345_NODE",
                    "x": vals[0],
                    "y": vals[1],
                    "z": vals[2],
                    "rssi": -40
                }

                with queue_lock:
                    data_queue.append(payload)

            except ValueError:
                stats["parse_errors"] += 1
                continue

        except Exception as e:
            tprint(f"\n[ERR] Okuma hatası: {e}")
            break

# ─────────────────────────────────────────────
#  THREAD 2 — Batch Gönderici
# ─────────────────────────────────────────────
def batch_sender():
    while not stop_event.is_set():
        with queue_lock:
            qsize = len(data_queue)

        if qsize >= BATCH_SIZE:
            with queue_lock:
                batch = [data_queue.popleft() for _ in range(BATCH_SIZE)]

            try:
                tprint(f"\n[BATCH] {BATCH_SIZE} veri gönderiliyor...")
                resp = session.post(API_URL, json=batch, timeout=5)
                if resp.status_code == 201:
                    stats["sent_batches"] += 1
                    tprint(f"[OK] Batch #{stats['sent_batches']} gönderildi ✓")
                else:
                    tprint(f"[ERR] HTTP {resp.status_code} hatası!")
            except Exception as e:
                tprint(f"[ERR] Bağlantı hatası: {e}")
        else:
            tprint(f"\rKayıt: [{qsize:3d}/{BATCH_SIZE}] | Filtre:{stats['filtered']}", end="", flush=True)
            time.sleep(0.1)

# ─────────────────────────────────────────────
#  ANA PROGRAM
# ─────────────────────────────────────────────
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    time.sleep(2)
    ser.reset_input_buffer()
    
    tprint(f"--- ADXL345 Köprüsü Başladı ({SERIAL_PORT}) ---")
    
    t1 = threading.Thread(target=serial_reader, args=(ser,), daemon=True)
    t2 = threading.Thread(target=batch_sender, daemon=True)
    t1.start(); t2.start()

    while True: time.sleep(1)

except KeyboardInterrupt:
    tprint("\n[STOP] Durduruldu.")
finally:
    stop_event.set()
    if 'ser' in locals(): ser.close()