import serial
import math
from vpython import *

# --- AYARLAR ---
SERIAL_PORT = 'COM11'  # Portun doğru olduğundan emin ol
BAUD_RATE = 115200

# --- 3D SAHNE KURULUMU ---
scene = canvas(title='ADXL345 Canlı 3D Simülasyon', width=800, height=600, background=color.gray(0.2))
scene.range = 5

# Mavi Sensör Kutusu
sensor_box = box(length=4, width=3, height=0.5, color=color.blue, opacity=0.9)

# Açı Metni
angle_text = label(pos=vector(0, -3, 0), text='Roll: 0 | Pitch: 0', box=False, height=20)

try:
    print(f"[{SERIAL_PORT}] Bağlanılıyor...")
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
    ser.reset_input_buffer()
    print("Bağlantı Başarılı! Tarayıcına bak...")

    while True:
        rate(50) # Saniyede 50 kare çiz (Arduino hızıyla aynı)
        
        if ser.in_waiting > 0:
            # GECİKME ÖNLEYİCİ: Kablodaki tüm verileri oku, sadece EN SONUNCUYU al
            lines = ser.readlines() 
            if lines:
                try:
                    last_line = lines[-1].decode('utf-8', errors='ignore').strip()
                    parts = last_line.split(',')
                    
                    if len(parts) == 3:
                        x = float(parts[0])
                        y = float(parts[1])
                        z = float(parts[2])
                        
                        # --- EĞİM HESAPLAMALARI ---
                        roll = math.atan2(y, z)
                        pitch = math.atan2(-x, math.sqrt(y*y + z*z))
                        
                        roll_deg = math.degrees(roll)
                        pitch_deg = math.degrees(pitch)
                        
                        # --- KUTUYU DÖNDÜR ---
                        # Her karede eksenleri sıfırla ki dönüşler sapmasın
                        sensor_box.axis = vector(1, 0, 0)
                        sensor_box.up = vector(0, 1, 0)
                        
                        sensor_box.rotate(angle=pitch, axis=vector(0, 0, 1))
                        sensor_box.rotate(angle=roll, axis=vector(1, 0, 0))
                        
                        angle_text.text = f'Roll: {int(roll_deg)} | Pitch: {int(pitch_deg)}'
                        
                except ValueError:
                    pass # Arada bozuk veri gelirse program çökmesin, yut

except serial.SerialException as e:
    print(f"Bağlantı Hatası: {e}")
finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()