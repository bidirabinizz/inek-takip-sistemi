from django.contrib import admin
from django.urls import path
from core import views  # ← "from core.views import ..." yerine bunu kullan

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/gercek-sensor/',     views.sensor_api),
    path('api/cihazlar/',          views.get_devices),
    path('api/cihaz-guncelle/',    views.update_device_steps),
    path('api/cihaz-gecmisi/',     views.cihaz_gecmisi),
    path('api/aktivite-guncelle/', views.aktivite_guncelle),
    path('api/kizginlik-raporu/',  views.kizginlik_raporu),
    path('api/aktivite-durum/',    views.aktivite_durum),   # ← artık çalışır
    path('cihaz-status/<str:mac>/', views.cihaz_status, name='cihaz_status'),
    path('api/cihazlar-heatmap/', views.cihazlar_heatmap, name='cihazlar_heatmap'),
    path('api/auth/login/',        views.custom_login),
    path('api/auth/logout/',       views.custom_logout),
    path('api/settings/',          views.get_settings),
    path('api/settings/update/',  views.update_settings),
]