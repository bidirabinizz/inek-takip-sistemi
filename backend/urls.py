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
]