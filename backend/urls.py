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
    # Animals CRUD
    path('api/animals/',           views.animal_list, name='animal_list'),
    path('api/animals/create/',   views.animal_create, name='animal_create'),
    path('api/animals/<int:id>/',  views.animal_detail, name='animal_detail'),
    # Device Assignment
    path('api/devices/assign/',    views.assign_animal_to_device, name='assign_animal_to_device'),
    path('api/devices/unassign/',  views.unassign_animal_from_device, name='unassign_animal_from_device'),
    # User Management (Admin only)
       path('api/users/',             views.user_list, name='user_list'),
       path('api/users/create/',      views.user_create, name='user_create'),
       path('api/users/<int:id>/',    views.user_detail, name='user_detail'),
       path('api/users/<int:id>/role/', views.user_update_role, name='user_update_role'),
       path('api/dashboard-summary/', views.dashboard_summary, name='dashboard_summary'),
   ]