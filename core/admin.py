from django.contrib import admin
from .models import AccelerometerData, Device, GunlukAktivite

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'mac_address', 'cow_id', 'location', 'total_steps', 'last_seen')
    list_filter = ('location', 'cow_id')
    search_fields = ('mac_address', 'name', 'cow_id')
    ordering = ('-last_seen',)

@admin.register(AccelerometerData)
class AccelerometerDataAdmin(admin.ModelAdmin):
    list_display = ('device_mac', 'created_at', 'x', 'y', 'z', 'signal_strength')
    list_filter = ('device_mac',)
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

@admin.register(GunlukAktivite)
class GunlukAktiviteAdmin(admin.ModelAdmin):
    list_display = ('mac', 'tarih', 'kizginlik_skoru', 'kizginlik_alarm', 'toplam_adim', 'yatma_suresi_dk')
    list_filter = ('kizginlik_alarm', 'tarih')
    search_fields = ('mac',)
    ordering = ('-tarih',)

