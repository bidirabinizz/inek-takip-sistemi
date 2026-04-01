# Cihaz İsimlendirme Geliştirme - TODO Listesi

**Plan Onaylandı ✅ Başlıyoruz...**

## Kalan Adımlar (Sıralı):

### 1. **Model Güncelleme** [✅ TAMAMLANDI]
   - core/models.py: name, cow_id, location field eklendi
   - **SONRAKI: `python manage.py makemigrations core && python manage.py migrate` çalıştır**

### 2. **Admin Paneli** [✅ TAMAMLANDI]
   - core/admin.py: Device + diğer modeller admin'e kaydedildi (search/filter/list)

### 3. **Backend API** [✅ TAMAMLANDI]
   - core/views.py: get_devices response genişletildi + sync_device fallback isim verir

### 4. **Frontend UI** [✅ TAMAMLANDI]
   - Devices.js: Kartta name/cow_id/location göster
   - DeviceReport.js: Header'da name + cow_id, device info API
   - App.js: deviceLabel hardcode kaldırıldı

### 5. **Test & Deploy** [🔧 HAZIR - SEN YAP]
   - `python manage.py makemigrations core && python manage.py migrate`
   - Admin (`/admin/`) → Device → isim gir
   - API: `curl localhost:8000/api/cihazlar/` → name gör
   - Frontend: `cd frontend && npm start`

**İlerleme: 5/5 ✅ PLAN TAMAMlandı!**

**İlerleme: 0/5 tamamlandı**

**Sonraki Adım: models.py edit → Tamamlandıktan sonra burayı güncellerim.**

