from django.contrib import admin
from .models import (
    AccelerometerData, Device, GunlukAktivite, Animal,
    SystemSettings, Paddock, Insemination, RolePermission
)

@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ('ear_tag', 'name', 'gender', 'paddock', 'is_active', 'created_at')
    list_filter = ('gender', 'is_active', 'paddock')
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


@admin.register(Paddock)
class PaddockAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Insemination)
class InseminationAdmin(admin.ModelAdmin):
    list_display = ('animal', 'insemination_date', 'status', 'technician', 'expected_calving_date')
    list_filter = ('status', 'insemination_date')
    search_fields = ('animal__ear_tag', 'animal__name', 'technician', 'bull_info')
    ordering = ('-insemination_date',)
    date_hierarchy = 'insemination_date'


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission_key', 'is_allowed')
    list_filter = ('role', 'is_allowed')
    search_fields = ('permission_key',)
    ordering = ('role', 'permission_key')
