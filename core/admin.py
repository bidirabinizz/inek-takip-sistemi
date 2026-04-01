from django.contrib import admin
from .models import AccelerometerData, Device, GunlukAktivite, Animal, SystemSettings

@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ('ear_tag', 'name', 'gender', 'is_active', 'created_at')
    list_filter = ('gender', 'is_active')
    search_fields = ('ear_tag', 'name')
    ordering = ('-created_at',)

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'mac_address', 'animal', 'location', 'total_steps', 'last_seen')
    list_filter = ('location', 'animal')
    search_fields = ('mac_address', 'name', 'animal__ear_tag', 'animal__name')
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

@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'EXCITED_MAG', 'WALK_STD_MIN', 'STILL_STD_MAX', 'FETCH_INTERVAL_MS')
    list_filter = ()
    search_fields = ()
    ordering = ()

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

