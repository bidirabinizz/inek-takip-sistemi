# 🐄 İvme IoT: Akıllı Büyükbaş Takip Platformu

![Version](https://img.shields.io/badge/version-v1.1.0-blue.svg)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)
![Backend](https://img.shields.io/badge/Backend-Django-092E20?logo=django&logoColor=white)
![Hardware](https://img.shields.io/badge/Hardware-IoT_|_LoRaWAN-FF5722)

İvme IoT, büyükbaş hayvanların boyunlarına takılan akıllı tasmalar (ivmeölçer sensörleri) aracılığıyla hayvanların günlük aktivitelerini, sağlık durumlarını ve **kızgınlık (estrus) dönemlerini** yüksek hassasiyetle tespit eden modern bir tarım teknolojisi (AgriTech) platformudur.

## ✨ Öne Çıkan Özellikler

* 📡 **Hibrit Aktivite Algoritması:** Gelen ham (X, Y, Z) ivme verilerini işleyerek hayvanın anlık durumunu (*Yürüyor, Yatıyor, Ayakta Durağan, Kızgın/Atlıyor*) tespit eder.
* 🚨 **Otomatik Kızgınlık Tespiti:** Son 14 günlük hareket verisini analiz ederek "Baseline" (taban çizgi) oluşturur. Anormal adım ve sıçrama (excited) artışlarında sisteme acil durum alarmı düşer.
* 👥 **Rol Tabanlı Erişim Kontrolü (RBAC):** * 👑 **Admin (Patron):** Tüm sistemi yönetir, algoritma ayarlarını değiştirir, kullanıcı ekler/siler.
  * 🩺 **Vet (Veteriner):** Hayvan profillerini yönetir, detaylı sağlık ve aktivite raporlarını inceler.
  * 👷 **Worker (İşçi):** Sadece cihazları ve hayvanların anlık durumlarını (salt okunur olarak) görüntüler.
* ⚙️ **Dinamik Kalibrasyon Paneli:** Sensör hassasiyetleri, adım algılama eşikleri ve yatma/kalkma süreleri koda dokunmadan direkt UI üzerinden canlı olarak güncellenebilir.
* 📊 **Gelişmiş Dashboard:** Günlük toplam adım, alarmlı inekler ve canlı veri akışını Recharts ile görselleştiren vitrin ekranı.

## 🛠️ Teknoloji Yığını

**Frontend (Kullanıcı Arayüzü):**
* React.js (Hooks, Context API)
* Tailwind CSS (Modern, Karanlık Tema Arayüz)
* Recharts (Veri Görselleştirme ve Grafikleme)
* Axios (CSRF Korumalı API İstekleri)

**Backend (Sunucu & API):**
* Python / Django & Django REST Framework
* Gelişmiş Filtreleme ve Hareket Sinyal İşleme Mimarisi
* SQLite / PostgreSQL (Veritabanı)
* Waitress (WSGI Production Server)

**Donanım & Kenar Bilişim (Edge):**
* BMA400 İvmeölçer Sensörleri
* LoRaWAN Tabanlı İletişim (LoRa-E5)
* Uçta Veri İşleme (Edge Computing) Altyapısı

## 🚀 Kurulum ve Çalıştırma

Projeyi kendi lokal ortamınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Depoyu Klonlayın
```bash
git clone [https://github.com/kullaniciadi/inek-takip-sistemi.git](https://github.com/kullaniciadi/inek-takip-sistemi.git)
cd inek-takip-sistemi

# Sanal ortam oluşturun ve aktif edin
python -m venv venv
source venv/Scripts/activate  # Windows için

# Gerekli kütüphaneleri yükleyin
pip install -r requirements.txt

# Veritabanını oluşturun ve varsayılan ayarları yükleyin
python manage.py makemigrations
python manage.py migrate


waitress-serve --listen=0.0.0.0:8000 backend.wsgi:application

waitress-serve --listen=0.0.0.0:8000 backend.wsgi:application
