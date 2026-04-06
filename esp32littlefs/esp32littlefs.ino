/*
  ============================================================
  Sığır Takip - KUSURSUZ v2.4 (Tam Entegre Dairesel Tampon)
  ============================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <LittleFS.h>
#include <sys/time.h>
#include <time.h>
#include "esp_wifi.h"
#include <math.h>

// ─── Kullanıcı Ayarları ───────────────────────────────────
const char* ssid      = "OpenMindSoft";
const char* password  = "OpEnMiNdSoFt";
const char* serverUrl = "http://192.168.170.6:8000/api/gercek-sensor/";

static char deviceMac[18] = "BILINMEYEN";  // WiFi bağlanınca doldurulacak
RTC_DATA_ATTR char rtc_mac[18] = "";

#define UPLOAD_INTERVAL_SEC    40   // 10 dakika
#define NTP_SERVER             "pool.ntp.org"

// ─── Pin ve Okuma Ayarları ────────────────────────────────
#define I2C_SDA        21
#define I2C_SCL        22
#define INT1_PIN       33
#define READ_INTERVAL  100   // 10Hz okuma aralığı (milisaniye)
#define IDLE_TIMEOUT_COUNT 30 // 3 saniye hareketsizlik barajı (30 * 100ms)

// ─── Hareket Eşikleri (Pencere Analizi) ───────────────────
// Std sapma tabanlı tespit — tek okuma değil, pencere kullanır
#define MOVEMENT_STD_THRESHOLD  0.5f   // Std bu değerin altındaysa cihaz "DURAĞAN" sayılır
#define MOVEMENT_WINDOW         10     // 10 okuma = 1 saniye

// ─── NTP Timeout ─────────────────────────────────────────
#define NTP_MAX_RETRY      20    
#define NTP_RETRY_DELAY_MS 1000  

// ─── Deep Sleep Korunan Değişkenler ──────────────────────
RTC_DATA_ATTR int      rtc_boot_count        = 0;
RTC_DATA_ATTR uint64_t rtc_last_upload_time  = 0;
RTC_DATA_ATTR bool     rtc_time_synced       = false; 

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

static char jsonBuffer[10240];
static int  bufferPos = 0;

// ─── Fonksiyon Prototipleri ───────────────────────────────
void    setupADXLInterrupts();
void    clearADXLInterrupt();
void    goToSleep(uint64_t current_time);
bool    connectWiFi();
bool    sendBatchToServer();
bool    syncTime();          

// ═════════════════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(200);

  rtc_boot_count++;
  Serial.printf("\n\n[BOOT #%d] Sistem uyandı.\n", rtc_boot_count);

  if (!LittleFS.begin(true)) {
    Serial.println("[HATA] LittleFS başlatılamadı!");
  }
  
  // ─── Saat Senkronizasyonu ─────────────────────────────
  if (!rtc_time_synced) {
    Serial.println("[SAAT] Saat henüz senkronize edilmedi, deneniyor...");
    if (connectWiFi()) {
      if (syncTime()) {
        rtc_time_synced = true;
        Serial.println("[SAAT] Senkronizasyon başarılı (UTC).");
      }
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
    } else {
      Serial.println("[SAAT] WiFi bağlanamadı.");
    }
  }

  // ─── Güvenlik Kalkanı: Saat Yoksa Kayıt Yok! ──────────
  if (!rtc_time_synced) {
      Serial.println("\n[GÜVENLİK] Saat alınamadı! Çöp veri kaydedilmesi engellendi.");
      Serial.println("[UYKU] Cihaz 1 dakika uyuyup saati çekmeyi tekrar deneyecek...\n");
      esp_sleep_enable_timer_wakeup(60 * 1000000ULL);
      Serial.flush();
      esp_deep_sleep_start();
      return; 
  }

  // ─── Mevcut Zamanı Al ─────────────────────────────────
  struct timeval tv_now;
  gettimeofday(&tv_now, NULL);
  uint64_t current_time = tv_now.tv_sec;

  if (rtc_last_upload_time == 0) {
    rtc_last_upload_time = current_time;
  }

  if (strlen(rtc_mac) > 0) {
  strncpy(deviceMac, rtc_mac, sizeof(deviceMac));
  Serial.printf("[MAC] RTC'den alındı: %s\n", deviceMac);
  }
  
  // ─── Sensör Başlat ────────────────────────────────────
  pinMode(INT1_PIN, INPUT);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);

  if (!accel.begin()) {
    Serial.println("[HATA] ADXL345 bulunamadı! Uyumaya geçiyor.");
    goToSleep(current_time);
    return;
  }

  accel.setRange(ADXL345_RANGE_4_G);
  accel.setDataRate(ADXL345_DATARATE_25_HZ);
  setupADXLInterrupts();
  clearADXLInterrupt();

  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  Serial.printf("[UYANIŞ] Sebep: %d (2=EXT0/Hareket, 4=Timer, 0=EN/Reset)\n", wakeup_reason);

  // ═══════════════════════════════════════════════════════
  //  1. HAREKETLİ KAYIT DÖNGÜSÜ
  // ═══════════════════════════════════════════════════════
  
  // Sadece EXT0 (Donanım kesmesi) veya Boot 1 durumunda zorla kayda gir
  bool shouldRecord = (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0 || rtc_boot_count == 1);

  if (shouldRecord) {
    Serial.println("[KAYIT] Hareket başladı, LittleFS'e yazılıyor...");

    File file = LittleFS.open("/veriler.txt", FILE_APPEND);
    if (file) {
      int idle_counter   = 0;
      int recorded_lines = 0;

      // ─── Dairesel Tampon Değişkenleri ───
      float window[MOVEMENT_WINDOW] = {0};
      int winIdx = 0;
      int filled = 0;

      while (idle_counter < IDLE_TIMEOUT_COUNT) {
        // 1. Sensörü SADECE BURADA 1 kere oku
        sensors_event_t event;
        accel.getEvent(&event);

        float ax  = event.acceleration.x;
        float ay  = event.acceleration.y;
        float az  = event.acceleration.z;
        float mag = sqrtf(ax*ax + ay*ay + az*az);

        // 2. Okunan değeri tampona ekle
        window[winIdx] = mag;
        winIdx = (winIdx + 1) % MOVEMENT_WINDOW;
        if (filled < MOVEMENT_WINDOW) filled++;

        // 3. Tampon dolduğunda sürekli Std Sapma kontrolü yap
        if (filled == MOVEMENT_WINDOW) {
            float sum = 0;
            for (int i = 0; i < MOVEMENT_WINDOW; i++) sum += window[i];
            float avg = sum / MOVEMENT_WINDOW;

            float var = 0;
            for (int i = 0; i < MOVEMENT_WINDOW; i++) var += (window[i] - avg) * (window[i] - avg);
            float std = sqrtf(var / MOVEMENT_WINDOW);

            if (std > MOVEMENT_STD_THRESHOLD) {
                idle_counter = 0; // Hareket devam ediyor, sayacı sıfırla
            } else {
                idle_counter++;   // Hareket yok, uykuyu yaklaştır
            }
        }

        // 4. Veriyi zaman kaybetmeden JSON olarak yaz
        struct timeval now_tv;
        gettimeofday(&now_tv, NULL);
        struct tm *ti = gmtime(&now_tv.tv_sec); 

        char timeStr[40];
        snprintf(timeStr, sizeof(timeStr),
                 "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
                 ti->tm_year + 1900, ti->tm_mon + 1, ti->tm_mday,
                 ti->tm_hour, ti->tm_min, ti->tm_sec,
                 (int)(now_tv.tv_usec / 1000));

        char item[200];
        snprintf(item, sizeof(item),
         "{\"mac\":\"%s\",\"x\":%.3f,\"y\":%.3f,\"z\":%.3f,"
         "\"rssi\":-55,\"zaman\":\"%s\"}\n",
         deviceMac, ax, ay, az, timeStr);

        file.print(item);
        recorded_lines++;

        // 5. Tam tamına 100ms bekle ve döngüyü tekrarla
        delay(READ_INTERVAL);
      }

      file.close();
      Serial.printf("[KAYIT BİTTİ] %d satır kaydedildi.\n", recorded_lines);
    } else {
      Serial.println("[HATA] Dosya açılamadı!");
    }
  } else {
      Serial.println("[KAYIT] Cihaz hareketsiz (Masada duruyor veya Timer uyanması). Kayıt pas geçildi.");
  }

  // ═══════════════════════════════════════════════════════
  //  2. UPLOAD KONTROLÜ
  // ═══════════════════════════════════════════════════════
  gettimeofday(&tv_now, NULL);
  current_time = tv_now.tv_sec;
  uint64_t elapsed = current_time - rtc_last_upload_time;

  Serial.printf("[UPLOAD] Geçen süre: %llu sn / %d sn gerekli\n",
                elapsed, UPLOAD_INTERVAL_SEC);

  if (elapsed >= UPLOAD_INTERVAL_SEC) {
    if (LittleFS.exists("/veriler.txt")) {
      Serial.println("[UPLOAD] Dosya bulundu, gönderiliyor...");

      if (connectWiFi()) {
        File readFile = LittleFS.open("/veriler.txt", FILE_READ);
        bool all_ok   = true;

        if (readFile) {
          int batch_num = 0;
          while (readFile.available()) {
            jsonBuffer[0] = '[';
            bufferPos     = 1;
            int count     = 0;

            while (readFile.available() && count < 50) {
              String line = readFile.readStringUntil('\n');
              line.trim();
              if (line.length() > 10) {
                if (count > 0) jsonBuffer[bufferPos++] = ',';
                memcpy(jsonBuffer + bufferPos, line.c_str(), line.length());
                bufferPos += line.length();
                count++;
              }
            }

            if (count > 0) {
              jsonBuffer[bufferPos++] = ']';
              jsonBuffer[bufferPos]   = '\0';
              batch_num++;
              Serial.printf("[UPLOAD] Batch #%d (%d kayıt) gönderiliyor...\n",
                            batch_num, count);
              if (!sendBatchToServer()) {
                Serial.println("[UPLOAD] Batch gönderilemedi, durduruluyor.");
                all_ok = false;
                break;
              }
            }
          }
          readFile.close();

          if (all_ok) {
            LittleFS.remove("/veriler.txt");
            Serial.println("[UPLOAD] Tüm veriler gönderildi, dosya silindi.");
          }
        }

        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
      } else {
        Serial.println("[UPLOAD] WiFi bağlanamadı, bir sonraki döngüde tekrar deneyecek.");
      }
    } else {
      Serial.println("[UPLOAD] Gönderilecek veri yok.");
    }
    rtc_last_upload_time = current_time;
  }

  goToSleep(current_time);
}

void loop() { }

// ═════════════════════════════════════════════════════════
//  NTP SAAT SENKRONİZASYONU
// ═════════════════════════════════════════════════════════
bool syncTime() {
  configTime(0, 0, NTP_SERVER);

  Serial.print("[SAAT] NTP bekleniyor");
  struct tm timeinfo;
  int retry = 0;

  while (retry < NTP_MAX_RETRY) {
    delay(NTP_RETRY_DELAY_MS);
    Serial.print(".");
    if (getLocalTime(&timeinfo, 0) && timeinfo.tm_year >= (2020 - 1900)) {
      Serial.printf("\n[SAAT] OK → %04d-%02d-%02d %02d:%02d:%02d\n",
                    timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
      return true;
    }
    retry++;
  }

  Serial.println("\n[SAAT] Timeout — NTP yanıt vermedi.");
  return false;
}

// ═════════════════════════════════════════════════════════
//  WiFi BAĞLAN
// ═════════════════════════════════════════════════════════
bool connectWiFi() {
  setCpuFrequencyMhz(240);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.begin(ssid, password);

  Serial.print("[WiFi] Bağlanıyor");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500); Serial.print("."); retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFi.setTxPower(WIFI_POWER_19_5dBm);

    // ── MAC adresini al ve kaydet ──────────────
    String mac = WiFi.macAddress();
    mac.toCharArray(deviceMac, sizeof(deviceMac));
    strncpy(rtc_mac, deviceMac, sizeof(rtc_mac));  // ← RTC'ye yaz
    Serial.println("\n[WiFi] Bağlandı → " + WiFi.localIP().toString());
    Serial.println("[WiFi] MAC → " + mac);

    return true;
  }

  Serial.println("\n[WiFi] Bağlantı başarısız.");
  return false;
}

// ═════════════════════════════════════════════════════════
//  HTTP BATCH GÖNDER
// ═════════════════════════════════════════════════════════
bool sendBatchToServer() {
  HTTPClient http;
  http.setTimeout(7000);
  if (!http.begin(serverUrl)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");
  http.addHeader("ngrok-skip-browser-warning", "true");
  int code = http.POST(jsonBuffer);
  bool ok  = (code == 200 || code == 201);
  if (ok) http.getString();
  http.end();
  Serial.printf("[HTTP] Sonuç: %d\n", code);
  return ok;
}

// ═════════════════════════════════════════════════════════
//  ADXL345 DONANIM KESMESİ
// ═════════════════════════════════════════════════════════
void setupADXLInterrupts() {
  Wire.beginTransmission(0x53);
  Wire.write(0x24); Wire.write(30); // Uyanma Hassasiyeti (Daha Sağır)
  Wire.endTransmission();
  Wire.beginTransmission(0x53);
  Wire.write(0x27); Wire.write(0xF0);
  Wire.endTransmission();
  Wire.beginTransmission(0x53);
  Wire.write(0x2F); Wire.write(0x00);
  Wire.endTransmission();
  Wire.beginTransmission(0x53);
  Wire.write(0x2E); Wire.write(0x10);
  Wire.endTransmission();
}

void clearADXLInterrupt() {
  Wire.beginTransmission(0x53);
  Wire.write(0x30); // INT_SOURCE register
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)0x53, (uint8_t)1);
  if (Wire.available()) {
      uint8_t intSource = Wire.read(); 
      // Sadece okumak bile kesmeyi temizler. 
      // Ekrana basarak yavaşlatmıyoruz.
  }
}

// ═════════════════════════════════════════════════════════
//  DEEP SLEEP'E GEÇ
// ═════════════════════════════════════════════════════════
void goToSleep(uint64_t current_time) {
  // Cihazın toparlanması için minik bir bekleme
  delay(100);
  
  uint64_t elapsed       = current_time - rtc_last_upload_time;
  uint64_t sleep_sec     = 1;

  if (elapsed < UPLOAD_INTERVAL_SEC) {
    sleep_sec = UPLOAD_INTERVAL_SEC - elapsed;
  }

  Serial.printf("[UYKU] %llu sn uyuyacak veya harekette uyanacak.\n", sleep_sec);
  Serial.flush();

  // Uykuya dalmadan hemen önce kesmeyi kör nokta kalmasın diye ZORLA temizle
  clearADXLInterrupt();
  delay(50); // Pin seviyesinin düşmesi için ufak zaman tanınır

  esp_sleep_enable_ext0_wakeup((gpio_num_t)INT1_PIN, 1);
  esp_sleep_enable_timer_wakeup(sleep_sec * 1000000ULL);

  esp_deep_sleep_start();
}
