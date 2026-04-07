from functools import wraps
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import (
    AccelerometerData, Device, GunlukAktivite, SystemSettings,
    Animal, UserProfile, Paddock, Insemination,
    RolePermission, ALL_PERMISSIONS
)
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Prefetch, F
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from django.utils.timezone import make_aware, is_naive, localtime
from datetime import date, datetime, timedelta
import math
from .activity_processor import classifyActivityRaw


# ─────────────────────────────────────────────
#  İZİN SİSTEMİ YARDIMCILARI
# ─────────────────────────────────────────────
def has_permission(user, permission_key):
    """Kullanıcının belirli bir izni olup olmadığını kontrol eder."""
    if not user.is_authenticated:
        return False
    role = user.profile.role if hasattr(user, 'profile') else 'WORKER'
    if role == 'ADMIN':
        return True
    perm = RolePermission.objects.filter(role=role, permission_key=permission_key).first()
    return perm.is_allowed if perm else False


def require_permission(permission_key):
    """View dekoratörü — izin kontrolü yapar."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return Response({"error": "Authentication required"}, status=401)
            if not has_permission(request.user, permission_key):
                return Response({"error": "Bu işlem için yetkiniz yok"}, status=403)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


# ─────────────────────────────────────────────
#  YARDIMCI — Günlük Aktivite Zamanlayıcıları
# ─────────────────────────────────────────────
def update_daily_activity_timers(kayit, created, mac, current_time, raw_activity, settings=None, data_start=None, data_end=None):
    """
    Handles Day Rollover (carry-over) and STILL/LYING timer logic.
    Returns: (kayit, is_lying, still_mins)
    """
    from django.utils.timezone import make_aware
    import datetime

    bugun = current_time.date() if hasattr(current_time, 'date') else date.today()

    # ── Day Rollover (Carry-Over) Logic ──
    if created:
        yesterday = bugun - datetime.timedelta(days=1)
        eski_kayit = GunlukAktivite.objects.filter(mac=mac, tarih=yesterday).first()
        if eski_kayit:
            midnight_naive = datetime.datetime.combine(bugun, datetime.time.min)
            midnight = make_aware(midnight_naive) if is_naive(current_time) else make_aware(midnight_naive, timezone.get_current_timezone())

            # 1. Transfer lying time up to midnight
            if eski_kayit.lying_start_time:
                elapsed = int((midnight - eski_kayit.lying_start_time).total_seconds() / 60)
                eski_kayit.yatma_suresi_dk += max(0, elapsed)
                eski_kayit.lying_start_time = None
                kayit.lying_start_time = midnight

            # 2. Transfer still time
            if eski_kayit.still_start_time:
                eski_kayit.still_start_time = None
                kayit.still_start_time = midnight

            # 3. Transfer last activity state
            kayit.last_activity = eski_kayit.last_activity
            kayit.last_activity_time = eski_kayit.last_activity_time
            eski_kayit.save()

    # ── STILL kronometresi ──
    if raw_activity == "STILL":
        if not kayit.still_start_time:
            if data_start:
                parsed = parse_datetime(data_start)
                kayit.still_start_time = parsed if parsed else current_time
            else:
                kayit.still_start_time = current_time
    else:
        if kayit.still_start_time:
            kayit.still_start_time = None
        if kayit.lying_start_time:
            elapsed = int((current_time - kayit.lying_start_time).total_seconds() / 60)
            kayit.yatma_suresi_dk += elapsed
            kayit.lying_start_time = None

    # ── LYING yönetimi ──
    still_mins = 0
    if kayit.still_start_time:
        ref_time = parse_datetime(data_end) if data_end else current_time
        still_mins = int((ref_time - kayit.still_start_time).total_seconds() / 60)

    # Determine night time and lying threshold
    if settings:
        gece_mi = current_time.hour >= settings.LYING_NIGHT_START or current_time.hour < settings.LYING_NIGHT_END
        lying_threshold = settings.LYING_STILL_MIN_MINUTES
    else:
        gece_mi = current_time.hour >= 22 or current_time.hour < 6
        lying_threshold = 10

    is_lying = gece_mi or (raw_activity == "STILL" and still_mins >= lying_threshold)

    if is_lying:
        if not kayit.lying_start_time:
            kayit.lying_start_time = kayit.still_start_time or current_time
    else:
        if kayit.lying_start_time:
            elapsed = int((current_time - kayit.lying_start_time).total_seconds() / 60)
            kayit.yatma_suresi_dk += elapsed
            kayit.lying_start_time = None

    return kayit, is_lying, still_mins


# ─────────────────────────────────────────────
#  SENSÖR API
# ─────────────────────────────────────────────
def _process_sensor_data_batch(mac, x_list, y_list, z_list, mag_list, created_time, rssi=None):
    """
    Sensör verisini işler (batch modu):
    - Aktivite sınıflandırması yapar (tüm batch için bir kez)
    - Adım sayısını hesaplar
    - Device.total_steps günceller
    - GunlukAktivite kaydını günceller
    """
    settings = SystemSettings.get_instance()
    
    # Aktivite sınıflandırması (listelerle)
    activity_type, steps, excited_count = classifyActivityRaw(x_list, y_list, z_list, mag_list, settings)
    
    # Cihaz kayıt/güncelleme
    device, _ = Device.objects.get_or_create(mac_address=mac, defaults={'name': f"İnek-{mac[:8].upper()}"})
    device.total_steps = F('total_steps') + steps
    device.last_seen = created_time
    device.save()
    device.refresh_from_db()
    
    # Günlük aktivite güncelleme
    bugun = created_time.date() if hasattr(created_time, 'date') else date.today()
    saat = created_time.hour if hasattr(created_time, 'hour') else timezone.now().hour
    gece_mi = saat >= settings.LYING_NIGHT_START or saat < settings.LYING_NIGHT_END
    
    kayit, created = GunlukAktivite.objects.get_or_create(mac=mac, tarih=bugun)
    # Assign animal based on current device mapping (Data Lineage fix)
    current_device = Device.objects.filter(mac_address=mac).first()
    if current_device and current_device.animal:
        kayit.animal = current_device.animal
    
    # Use helper to handle carry-over and timer logic
    kayit, is_lying, still_mins = update_daily_activity_timers(
        kayit=kayit,
        created=created,
        mac=mac,
        current_time=created_time,
        raw_activity=activity_type,
        settings=settings
    )
    kayit.toplam_adim = F('toplam_adim') + steps
    kayit.excited_count = F('excited_count') + excited_count
    if gece_mi:
        kayit.gece_adim = F('gece_adim') + steps
    kayit.save()
    kayit.refresh_from_db()
    
    # Final aktivite kararı
    if activity_type == "EXCITED":
        final_activity = "KIZGINLIK"
    elif activity_type == "WALKING":
        final_activity = "YÜRÜYOR"
    elif is_lying:
        final_activity = "YATIYOR"
    elif activity_type == "STILL":
        final_activity = "Durağan / Ayakta"
    else:
        # Varsayılan olarak Durağan / Ayakta (UNKNOWN yerine)
        final_activity = "Durağan / Ayakta"
    
    kayit.last_activity = final_activity
    kayit.last_activity_time = created_time
    kayit.kizginlik_skoru = hesapla_kizginlik_skoru(mac, bugun)
    kayit.kizginlik_alarm = kayit.kizginlik_skoru >= 60
    kayit.save()
    
    return steps, excited_count, final_activity


@api_view(['POST', 'GET'])
def sensor_api(request):
    if request.method == 'POST':
        data = request.data

        if isinstance(data, list):
            # Assume all items belong to the same device (use MAC from first item)
            mac = None
            if len(data) > 0:
                mac = data[0].get('mac')
                if mac:
                    Device.objects.get_or_create(mac_address=mac, defaults={'name': f"İnek-{mac[:8].upper()}"})
            # Prepare batch lists
            x_list, y_list, z_list, mag_list = [], [], [], []
            records = []
            for item in data:
                zaman_str = item.get('zaman')
                created_time = timezone.now()
                if zaman_str:
                    parsed_time = parse_datetime(zaman_str.replace(' ', 'T'))
                    if parsed_time:
                        if is_naive(parsed_time):
                            parsed_time = make_aware(parsed_time)
                        created_time = parsed_time
                mac_item = item.get('mac', 'BİLİNMEYEN_CİHAZ')
                x = item.get('x', 0.0)
                y = item.get('y', 0.0)
                z = item.get('z', 0.0)
                rssi = item.get('rssi')
                # Build lists for batch processing
                x_list.append(x)
                y_list.append(y)
                z_list.append(z)
                mag_list.append(math.sqrt(x**2 + y**2 + z**2))
                # Prepare DB record
                records.append(
                    AccelerometerData(
                        device_mac=mac_item,
                        x=x, y=y, z=z,
                        signal_strength=rssi,
                        created_at=created_time
                    )
                )
            # Use the timestamp of the last record for batch DB updates (or now if none)
            batch_time = records[-1].created_at if records else timezone.now()
            # Process batch data
            steps, excited, activity = _process_sensor_data_batch(mac, x_list, y_list, z_list, mag_list, batch_time)
            # Save all raw records in bulk
            AccelerometerData.objects.bulk_create(records)
            print(f"[Sensör API] {len(records)} kayıt işlendi. Toplam adım: {steps}, Excited: {excited}")
            # WebSocket broadcast of the latest record
            channel_layer = get_channel_layer()
            if channel_layer and records:
                last_record = records[-1]
                async_to_sync(channel_layer.group_send)(
                    'sensor_data',
                    {
                        'type': 'sensor_data_update',
                        'data': {
                            'mac': last_record.device_mac,
                            'x': float(last_record.x),
                            'y': float(last_record.y),
                            'z': float(last_record.z),
                            'time': last_record.created_at.isoformat(),
                            'total_steps': steps,
                            'activity': activity,
                        }
                    }
                )
            return Response({"status": "success", "count": len(records), "steps": steps}, status=201)
        else:
            mac = data.get('mac')
            if mac:
                Device.objects.get_or_create(mac_address=mac, defaults={'name': f"İnek-{mac[:8].upper()}"})
            
            zaman_str = data.get('zaman')
            created_time = timezone.now()
            if zaman_str:
                parsed_time = parse_datetime(zaman_str.replace(' ', 'T'))
                if parsed_time:
                    if is_naive(parsed_time):
                        parsed_time = make_aware(parsed_time)
                    created_time = parsed_time

            x = data.get('x', 0.0)
            y = data.get('y', 0.0)
            z = data.get('z', 0.0)
            rssi = data.get('rssi')
            
            # Aktivite işleme
            steps, excited, activity = _process_sensor_data(mac or 'BİLİNMEYEN_CİHAZ', x, y, z, created_time, rssi)
            
            AccelerometerData.objects.create(
                device_mac=mac or 'BİLİNMEYEN_CİHAZ',
                x=x, y=y, z=z,
                signal_strength=rssi,
                created_at=created_time
            )
            print(f"[Sensör API] Tekil kayıt işlendi. Adım: {steps}, Aktivite: {activity}")
            
            # WebSocket broadcast gönder
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    'sensor_data',
                    {
                        'type': 'sensor_data_update',
                        'data': {
                            'mac': mac or 'BİLİNMEYEN_CİHAZ',
                            'x': float(x),
                            'y': float(y),
                            'z': float(z),
                            'time': created_time.isoformat(),
                            'steps': steps,
                            'activity': activity,
                            'excited': excited
                        }
                    }
                )
            
            return Response({"status": "success", "steps": steps, "activity": activity}, status=201)

    if request.method == 'GET':
        data = AccelerometerData.objects.all().order_by('-created_at')[:600]
        res = [
            {"mac": d.device_mac, "x": d.x, "y": d.y, "z": d.z,
             "rssi": d.signal_strength, "time": localtime(d.created_at)}
            for d in data
        ]
        return Response(res)


# ─────────────────────────────────────────────
#  CİHAZ LİSTESİ
# ─────────────────────────────────────────────
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
def get_devices(request):
    devices = Device.objects.all().order_by('-last_seen')
    paginator = StandardResultsSetPagination()
    paginated_devices = paginator.paginate_queryset(devices, request)
    
    res = []
    for d in paginated_devices:
        device_data = {
            "mac": d.mac_address,
            "name": d.name,
            "location": d.location,
            "total_steps": d.total_steps,
            "last_seen": d.last_seen
        }
        # Include animal information if assigned
        if d.animal:
            device_data["animal"] = {
                "id": d.animal.id,
                "ear_tag": d.animal.ear_tag,
                "name": d.animal.name,
                "gender": d.animal.gender,
                "is_active": d.animal.is_active
            }
        else:
            device_data["animal"] = None
        res.append(device_data)
    return paginator.get_paginated_response(res)


# ─────────────────────────────────────────────
#  CİHAZ GEÇMİŞ VERİSİ (TARİH ARALIĞI)
# ─────────────────────────────────────────────
@api_view(['GET'])
def device_history_range(request):
    """
    Belirli bir tarih aralığında cihazın günlük aktivite verilerini döndürür.
    Parametreler: mac, start_date, end_date
    Tarihler eksikse varsayılan olarak son 7 gün kullanılır.
    """
    mac = request.GET.get('mac')
    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')
    
    if not mac:
        return Response({"error": "mac parametresi gerekli"}, status=400)
    
    # Tarihler eksik veya boşsa varsayılan değerler kullan
    bugun = date.today()
    if not start_date_str or not end_date_str:
        print("[device_history_range] Tarih parametreleri eksik, varsayılan son 7 gün kullanılıyor.")
        end_date = bugun
        start_date = bugun - timedelta(days=7)
        start_date_str = str(start_date)
        end_date_str = str(end_date)
    else:
        try:
            start_date = parse_date(start_date_str)
            end_date = parse_date(end_date_str)
            
            if not start_date or not end_date:
                print("[device_history_range] Geçersiz tarih formatı, varsayılan son 7 gün kullanılıyor.")
                end_date = bugun
                start_date = bugun - timedelta(days=7)
                start_date_str = str(start_date)
                end_date_str = str(end_date)
        except Exception:
            print("[device_history_range] Tarih işleme hatası, varsayılan son 7 gün kullanılıyor.")
            end_date = bugun
            start_date = bugun - timedelta(days=7)
            start_date_str = str(start_date)
            end_date_str = str(end_date)
    
    # GunlukAktivite kayıtlarını getir
    kayitlar = GunlukAktivite.objects.filter(
        mac=mac,
        tarih__gte=start_date,
        tarih__lte=end_date
    ).order_by('tarih')
    
    if not kayitlar.exists():
        return Response({
            "mac": mac,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "data": [],
            "message": "Bu tarih aralığında veri bulunamadı"
        })
    
    data = []
    for k in kayitlar:
        data.append({
            'tarih': str(k.tarih),
            'toplam_adim': k.toplam_adim,
            'gece_adim': k.gece_adim,
            'excited_count': k.excited_count,
            'yatma_suresi_dk': k.yatma_suresi_dk,
            'kizginlik_skoru': k.kizginlik_skoru,
            'kizginlik_alarm': k.kizginlik_alarm,
            'last_activity': k.last_activity,
        })
    
    # Ortalamalar
    toplam_gun = len(data)
    ortalama_adim = sum(d['toplam_adim'] for d in data) / toplam_gun if toplam_gun > 0 else 0
    ortalama_yatma = sum(d['yatma_suresi_dk'] for d in data) / toplam_gun if toplam_gun > 0 else 0
    ortalama_skor = sum(d['kizginlik_skoru'] for d in data) / toplam_gun if toplam_gun > 0 else 0
    
    return Response({
        "mac": mac,
        "start_date": start_date_str,
        "end_date": end_date_str,
        "data": data,
        "ortalama_adim": round(ortalama_adim, 1),
        "ortalama_yatma_suresi": round(ortalama_yatma, 1),
        "ortalama_kizginlik_skoru": round(ortalama_skor, 1),
        "toplam_gun": toplam_gun,
    })


# ─────────────────────────────────────────────
#  PADOK ANALİTİĞİ
# ─────────────────────────────────────────────
@api_view(['GET'])
def paddock_analytics(request):
    """
    Her padok için bugünkü ortalama aktivite istatistiklerini döndürür.
    - Padok başına ortalama adım sayısı
    - Padok başına ortalama kızgınlık skoru
    - Padok başına alarm sayısı
    - Hayvan sayısı
    """
    bugun = date.today()
    
    # Tüm padokları al
    paddocks = Paddock.objects.all()
    
    result = []
    for paddock in paddocks:
        # Padoktaki aktif hayvanları say
        hayvan_sayisi = Animal.objects.filter(paddock=paddock, is_active=True).count()
        
        if hayvan_sayisi == 0:
            continue
        
        # Padoktaki hayvanların MAC adreslerini al (cihaz üzerinden)
        device_macs = Device.objects.filter(animal__paddock=paddock, animal__is_active=True).values_list('mac_address', flat=True)
        
        # Padoktaki hayvanların bugünkü aktivitelerini topla
        gunluk_aktiviteler = GunlukAktivite.objects.filter(
            mac__in=device_macs,
            tarih=bugun
        )
        
        if gunluk_aktiviteler.exists():
            toplam_adim = sum(ga.toplam_adim for ga in gunluk_aktiviteler)
            ortalama_adim = toplam_adim / hayvan_sayisi if hayvan_sayisi > 0 else 0
            
            toplam_skor = sum(ga.kizginlik_skoru for ga in gunluk_aktiviteler)
            ortalama_skor = toplam_skor / hayvan_sayisi if hayvan_sayisi > 0 else 0
            
            alarm_sayisi = sum(1 for ga in gunluk_aktiviteler if ga.kizginlik_alarm)
            
            # Ortalama yatma süresi
            yatma_sureleri = [ga.yatma_suresi_dk for ga in gunluk_aktiviteler if ga.yatma_suresi_dk > 0]
            ortalama_yatma = sum(yatma_sureleri) / len(yatma_sureleri) if yatma_sureleri else 0
        else:
            ortalama_adim = 0
            ortalama_skor = 0
            alarm_sayisi = 0
            ortalama_yatma = 0
        
        result.append({
            'paddock_id': paddock.id,
            'paddock_name': paddock.name,
            'hayvan_sayisi': hayvan_sayisi,
            'ortalama_adim': round(ortalama_adim, 1),
            'ortalama_kizginlik_skoru': round(ortalama_skor, 1),
            'alarm_sayisi': alarm_sayisi,
            'ortalama_yatma_suresi': round(ortalama_yatma, 1),
            'warning': ortalama_adim < 1000,  # Düşük aktivite uyarısı
        })
    
    return Response(result, status=200)


# ─────────────────────────────────────────────
#  ADIM GÜNCELLEME
# ─────────────────────────────────────────────
@api_view(['POST'])
def update_device_steps(request):
    mac       = request.data.get('mac')
    new_steps = request.data.get('steps', 0)
    if mac:
        device, _ = Device.objects.get_or_create(mac_address=mac)
        device.total_steps = F('total_steps') + int(new_steps)
        device.save()
        device.refresh_from_db()
        return Response({"status": "updated"}, status=200)
    return Response({"error": "No MAC provided"}, status=400)


# ─────────────────────────────────────────────
#  CİHAZ GEÇMİŞİ
# ─────────────────────────────────────────────
@api_view(['GET'])
def cihaz_gecmisi(request):
    mac      = request.GET.get('mac')
    queryset = AccelerometerData.objects.filter(device_mac=mac).order_by('created_at')[:500]
    res = [
        {"x": d.x, "y": d.y, "z": d.z,
         "mag": round((d.x**2 + d.y**2 + d.z**2)**0.5, 3),
         "timeLabel": localtime(d.created_at).strftime("%H:%M:%S")}
        for d in queryset
    ]
    return Response(res)


# ─────────────────────────────────────────────
#  YARDIMCI — Kızgınlık Skoru
# ─────────────────────────────────────────────
def hesapla_kizginlik_skoru(mac, hedef_tarih):
    yedi_gun_once = hedef_tarih - timedelta(days=7)
    gecmis_adimlar = list(
        GunlukAktivite.objects.filter(
            mac=mac,
            tarih__gte=yedi_gun_once,
            tarih__lt=hedef_tarih
        ).values_list("toplam_adim", flat=True)
    )
    if len(gecmis_adimlar) < 3:
        return 0.0
    baseline = sum(gecmis_adimlar) / len(gecmis_adimlar)
    if baseline == 0:
        return 0.0
    bugun = GunlukAktivite.objects.filter(mac=mac, tarih=hedef_tarih).first()
    if not bugun:
        return 0.0

    adim_artis_yuzde = (bugun.toplam_adim / baseline) * 100
    skor = 0
    if adim_artis_yuzde > 300:   skor += 50
    elif adim_artis_yuzde > 200: skor += 35
    elif adim_artis_yuzde > 150: skor += 20
    if bugun.gece_adim > 200:    skor += 30
    elif bugun.gece_adim > 100:  skor += 20
    elif bugun.gece_adim > 50:   skor += 10
    if bugun.excited_count > 20:  skor += 20
    elif bugun.excited_count > 10: skor += 12
    elif bugun.excited_count > 5:  skor += 6
    return min(float(skor), 100.0)


# ─────────────────────────────────────────────
#  AKTİVİTE GÜNCELLEME
# ─────────────────────────────────────────────
@api_view(['POST'])
def aktivite_guncelle(request):
    mac          = request.data.get('mac')
    steps        = int(request.data.get('steps', 0))
    excited      = int(request.data.get('excited', 0))
    raw_activity = request.data.get('raw_activity', 'UNKNOWN')
    data_start   = request.data.get('data_start')
    data_end     = request.data.get('data_end')
    
    if steps == 0 and raw_activity == "WALKING":
        raw_activity = "STILL"
        
    if not mac:
        return Response({"error": "mac gerekli"}, status=400)

    bugun   = date.today()
    now     = timezone.now()
    saat    = now.hour
    gece_mi = saat >= 22 or saat < 6

    # Convert WALKING/EXCITED with zero steps to STILL before processing
    if steps == 0 and raw_activity in ["WALKING", "EXCITED"]:
        raw_activity = "STILL"
    
    # Get or create daily activity record
    kayit, created = GunlukAktivite.objects.get_or_create(mac=mac, tarih=bugun)
    
    # Assign animal based on current device mapping (Data Lineage fix)
    current_device = Device.objects.filter(mac_address=mac).first()
    if current_device and current_device.animal:
        kayit.animal = current_device.animal
    
    # Use helper to handle carry-over and timer logic
    kayit, is_lying, still_mins = update_daily_activity_timers(
        kayit=kayit,
        created=created,
        mac=mac,
        current_time=now,
        raw_activity=raw_activity,
        settings=None,  # aktivite_guncelle uses inline gece_mi calculation (22-6)
        data_start=data_start,
        data_end=data_end
    )
    kayit.toplam_adim = F('toplam_adim') + steps
    kayit.excited_count = F('excited_count') + (1 if raw_activity == "EXCITED" else 0)
    if gece_mi:
        kayit.gece_adim = F('gece_adim') + steps
    kayit.save()
    kayit.refresh_from_db()

    # Final aktivite kararı
    if raw_activity == "EXCITED":
        final_activity = "KIZGINLIK"
    elif raw_activity == "WALKING":
        final_activity = "YÜRÜYOR"
    elif is_lying:
        final_activity = "YATIYOR"
    elif raw_activity == "STILL":
        final_activity = "Durağan / Ayakta"
    else:
        # Varsayılan olarak Durağan / Ayakta (UNKNOWN yerine)
        final_activity = "Durağan / Ayakta"

    # 🚀 SON AKTİVİTEYİ KAYDET
    kayit.last_activity = final_activity
    kayit.last_activity_time = now

    current_lying_mins = kayit.yatma_suresi_dk
    if kayit.lying_start_time:
        current_lying_mins += int((now - kayit.lying_start_time).total_seconds() / 60)

    kayit.kizginlik_skoru = hesapla_kizginlik_skoru(mac, bugun)
    kayit.kizginlik_alarm = kayit.kizginlik_skoru >= 60
    kayit.save()

    return Response({
        "status":           "updated",
        "final_activity":   final_activity,
        "lying_total_mins": current_lying_mins,
        "still_mins":       still_mins,
        "skor":             kayit.kizginlik_skoru,
        "alarm":            kayit.kizginlik_alarm,
    }, status=200)


@api_view(['GET'])
def aktivite_durum(request):
    """
    F5 veya yeni sekme açıldığında çağrılır.
    Son bilinen aktiviteyi döner.
    """
    mac = request.GET.get('mac')
    if not mac:
        return Response({"error": "mac gerekli"}, status=400)

    bugun = date.today()
    now = timezone.now()

    kayit = GunlukAktivite.objects.filter(mac=mac, tarih=bugun).first()

    if not kayit:
        return Response({
            "final_activity": "Durağan / Ayakta",
            "lying_total_mins": 0,
            "still_mins": 0,
        })

    # Anlık yatma süresi
    current_lying_mins = kayit.yatma_suresi_dk
    if kayit.lying_start_time:
        current_lying_mins += int(
            (now - kayit.lying_start_time).total_seconds() / 60
        )

    # Anlık durağan süre
    still_mins = 0
    if kayit.still_start_time:
        still_mins = int(
            (now - kayit.still_start_time).total_seconds() / 60
        )

    # 🚀 AKTİVİTE KARARI - SON KAYDEDİLEN DURUMU KULLAN
    final_activity = kayit.last_activity
    
    # Eğer son aktivite 5 dakikadan eskiyse, yeniden hesapla
    if kayit.last_activity_time:
        elapsed_seconds = (now - kayit.last_activity_time).total_seconds()
        if elapsed_seconds > 300:  # 5 dakika
            # Sayaçları kontrol et
            if kayit.lying_start_time:
                final_activity = "YATIYOR"
            elif kayit.still_start_time:
                saat = now.hour
                gece_mi = saat >= 22 or saat < 6
                if gece_mi or still_mins >= 10:
                    final_activity = "YATIYOR"
                else:
                    final_activity = "Durağan / Ayakta"
            else:
                # Varsayılan olarak Durağan / Ayakta
                final_activity = "Durağan / Ayakta"
    else:
        # Hiç kayıt yoksa varsayılan Durağan / Ayakta
        final_activity = "Durağan / Ayakta"

    return Response({
        "final_activity": final_activity,
        "lying_total_mins": current_lying_mins,
        "still_mins": still_mins,
    })
    
# ─────────────────────────────────────────────
#  KIZGINLIK RAPORU — Son 14 gün
# ─────────────────────────────────────────────
@api_view(['GET'])
def kizginlik_raporu(request):
    mac = request.GET.get('mac')
    if not mac:
        return Response({"error": "mac gerekli"}, status=400)

    bitis     = date.today()
    baslangic = bitis - timedelta(days=14)

    kayitlar = {
        k.tarih: k for k in GunlukAktivite.objects.filter(
            mac=mac,
            tarih__gte=baslangic,
            tarih__lte=bitis
        )
    }

    sonuc = []
    for i in range(15):
        gun = baslangic + timedelta(days=i)
        if gun in kayitlar:
            k = kayitlar[gun]
            sonuc.append({
                "tarih":           gun.strftime("%d/%m"),
                "toplam_adim":     k.toplam_adim,
                "gece_adim":       k.gece_adim,
                "excited_count":   k.excited_count,
                "kizginlik_skoru": k.kizginlik_skoru,
                "kizginlik_alarm": k.kizginlik_alarm,
                "yatma_suresi_dk": k.yatma_suresi_dk,
            })
        else:
            sonuc.append({
                "tarih":           gun.strftime("%d/%m"),
                "toplam_adim":     0,
                "gece_adim":       0,
                "excited_count":   0,
                "kizginlik_skoru": 0,
                "kizginlik_alarm": False,
                "yatma_suresi_dk": 0,
            })

    return Response(sonuc)
    
@api_view(['GET'])
def cihazlar_heatmap(request):
    try:
        sort_param = request.GET.get('sort', 'kizginlik')
        alert_param = request.GET.get('alert', 'all')
        bugun = date.today()
        
        # N+1 SORUNU ÇÖZÜLDÜ: Python dictionary map ile
        # GunlukAktivite ForeignKey değil, CharField (mac) kullandığı için prefetch_related çalışmıyor
        activities = GunlukAktivite.objects.filter(tarih=bugun)
        activity_map = {act.mac: act for act in activities}
        
        devices = Device.objects.all()
        
        res_data = []
        for d in devices:
            # Dictionary'den bugünkü aktiviteyi al
            aktivite = activity_map.get(d.mac_address)
            
            # 🚀 EMNİYET KİLİDİ: last_seen None ise hata vermesin
            is_online = False
            if d.last_seen:
                diff = (timezone.now() - d.last_seen).total_seconds()
                is_online = diff < 300
            
            item = {
                "mac": d.mac_address,
                "name": d.name if d.name else f"İnek-{d.mac_address[:6].upper()}",
                "kizginlik_skoru": aktivite.kizginlik_skoru if aktivite else 0,
                "total_steps": d.total_steps,
                "status": "online" if is_online else "offline",
                "alarm": aktivite.kizginlik_alarm if aktivite else False
            }
            # Include animal information if assigned
            if d.animal:
                item["animal"] = {
                    "ear_tag": d.animal.ear_tag,
                    "name": d.animal.name,
                    "gender": d.animal.gender,
                    "is_active": d.animal.is_active
                }
            else:
                item["animal"] = None
            res_data.append(item)
        
        # Sıralama mantığı
        if sort_param == 'kizginlik':
            res_data = sorted(res_data, key=lambda x: x['kizginlik_skoru'], reverse=True)
        elif sort_param == 'adim':
            res_data = sorted(res_data, key=lambda x: x['total_steps'], reverse=True)
        elif sort_param == 'name':
            res_data = sorted(res_data, key=lambda x: x['name'])
        
        if alert_param == 'has_alarm':
            res_data = [d for d in res_data if d['alarm']]
        
        return Response(res_data)
    except Exception as e:
        print(f"Heatmap Hatası: {e}") # Terminale hatayı basar
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def cihaz_status(request, mac):
    try:
        son_veri = AccelerometerData.objects.filter(device_mac=mac).order_by('-created_at').first()
        device = Device.objects.filter(mac_address=mac).first()
        
        # 🚀 EMNİYET KİLİDİ: last_seen kontrolü burada da şart
        last_seen_iso = None
        if device and device.last_seen:
            last_seen_iso = device.last_seen.isoformat()

        response = {
            "battery_percent": 87,
            "rssi": son_veri.signal_strength if son_veri else -80,
            "uptime_days": 14,
            "firmware": "v2.1.4",
            "last_seen": last_seen_iso,
            "status": "online" if son_veri and (timezone.now() - son_veri.created_at).total_seconds() < 300 else "offline"
        }
        return Response(response)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


# ─────────────────────────────────────────────
#  SİSTEM AYARLARI (Singleton)
# ─────────────────────────────────────────────
@api_view(['GET'])
def get_settings(request):
    """
    Sistem ayarlarını döner (Singleton).
    Dashboard'un çalışması için tüm giriş yapmış kullanıcılar (ADMIN, VET, WORKER) görebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    # 🚀 EĞER BURADA "if request.user.profile.role != 'ADMIN':" GİBİ BİR KONTROL VARSA SİL!
    
    from django.middleware.csrf import get_token
    get_token(request) # Dün eklediğimiz garanti CSRF şifresi
    
    settings = SystemSettings.get_instance()
    return Response(settings.to_dict(), status=200)


@api_view(['POST'])
def update_settings(request):
    """
    Sistem ayarlarını günceller (Singleton).
    Sadece ADMIN kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'ADMIN':
        return Response({"error": "Forbidden - Admin access required"}, status=403)
    
    settings = SystemSettings.get_instance()
    
    # Gelen veriyi güncelle
    allowed_fields = [
        'EXCITED_MAG', 'WALK_STD_MIN', 'WALK_STD_MAX', 'WALK_PEAKS_MIN',
        'STILL_STD_MAX', 'STILL_MAG_MIN', 'STILL_MAG_MAX',
        'LYING_STILL_MIN_MINUTES', 'LYING_NIGHT_START', 'LYING_NIGHT_END',
        'MAG_PEAK_THRESHOLD', 'MAG_VALLEY_THRESHOLD', 'COOLDOWN_MS', 'WINDOW_SIZE',
        'FETCH_INTERVAL_MS'
    ]
    
    for field in allowed_fields:
        if field in request.data:
            value = request.data[field]
            # Integer alanları kontrol et
            if field in ['WALK_PEAKS_MIN', 'LYING_STILL_MIN_MINUTES', 'LYING_NIGHT_START', 'LYING_NIGHT_END', 'COOLDOWN_MS', 'WINDOW_SIZE']:
                try:
                    setattr(settings, field, int(value))
                except (ValueError, TypeError):
                    return Response({"error": f"Invalid value for {field}"}, status=400)
            else:
                # Float alanlar
                try:
                    setattr(settings, field, float(value))
                except (ValueError, TypeError):
                    return Response({"error": f"Invalid value for {field}"}, status=400)
    
    settings.save()
    return Response({
        "status": "success",
        "message": "Settings updated",
        "settings": settings.to_dict()
    }, status=200)


# ─────────────────────────────────────────────
#  KULLANICI YÖNETİMİ — Login & Logout
# ─────────────────────────────────────────────
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def custom_login(request):
    """
    Kullanıcı girişi için basit bir endpoint.
    Frontend'den gelen username ve password ile giriş yapar.
    """
    from django.contrib.auth import authenticate, login
    from django.views.decorators.csrf import csrf_exempt
    
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({"error": "Kullanıcı adı ve şifre gerekli"}, status=400)
    
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        # Get user role from profile
        role = user.profile.role if hasattr(user, 'profile') else 'WORKER'
        return Response({
            "status": "success",
            "message": f"Hoş geldiniz, {user.username}",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": role
            }
        }, status=200)
    else:
        return Response({"error": "Geçersiz kullanıcı adı veya şifre"}, status=401)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def custom_logout(request):
    """
    Kullanıcı çıkışı için endpoint.
    """
    from django.contrib.auth import logout
    
    logout(request)
    return Response({
        "status": "success",
        "message": "Başarıyla çıkış yapıldı"
    }, status=200)


# ─────────────────────────────────────────────
#  KULLANICI YÖNETİMİ (User Management) - SADECE ADMIN
# ─────────────────────────────────────────────
@api_view(['GET'])
def user_list(request):
    """
    Tüm kullanıcıları listele. Sadece ADMIN erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'ADMIN':
        return Response({"error": "Forbidden - Admin access required"}, status=403)
    
    users = User.objects.all().order_by('-date_joined')
    data = []
    for user in users:
        role = user.profile.role if hasattr(user, 'profile') else 'WORKER'
        data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': role,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
        })
    return Response(data, status=200)


@api_view(['POST'])
def user_create(request):
    """
    Yeni kullanıcı oluşturur.
    Sadece ADMIN rolündeki kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated or not hasattr(request.user, 'userprofile') and not hasattr(request.user, 'profile'):
        return Response({"error": "Yetkiniz yok"}, status=403)
        
    # Rol kontrolünü güvenli yapalım (related_name 'profile' veya 'userprofile' olabilir)
    user_role = getattr(request.user, 'profile', getattr(request.user, 'userprofile', None))
    if not user_role or user_role.role != 'ADMIN':
        return Response({"error": "Sadece Adminler kullanıcı ekleyebilir."}, status=403)

    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    role = request.data.get('role', 'WORKER')

    if not username or not password:
        return Response({"error": "Kullanıcı adı ve şifre gereklidir."}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Bu kullanıcı adı zaten kullanılıyor."}, status=400)

    try:
        # 1. Kullanıcıyı güvenle yarat (Bizim sinyal burada profili otomatik açacak)
        user = User.objects.create_user(username=username, email=email, password=password)
        
        # 2. Çarpışmayı önlemek için get_or_create kullanıp sadece Rolü güncelliyoruz
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()

        # 3. Tarih çökmesini engellemek için str() ile dönüyoruz
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': profile.role,
            'date_joined': str(user.date_joined)
        }, status=201)

    except Exception as e:
        print(f"Kullanıcı Yaratma Hatası: {e}")
        return Response({"error": "Sunucu hatası: Kullanıcı oluşturulamadı."}, status=500)




@api_view(['DELETE'])
def user_delete(request, id):
    """
    Kullanıcı sil. Sadece ADMIN erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'ADMIN':
        return Response({"error": "Forbidden - Admin access required"}, status=403)
    
    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "Kullanıcı bulunamadı"}, status=404)
    
    # Prevent self-deletion
    if user.id == request.user.id:
        return Response({"error": "Kendi hesabınızı silemezsiniz"}, status=400)
    
    user.delete()
    return Response({"message": "Kullanıcı silindi"}, status=200)


@api_view(['PUT'])
def user_update_role(request, id):
    """
    Kullanıcı rolünü güncelle. Sadece ADMIN erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'ADMIN':
        return Response({"error": "Forbidden - Admin access required"}, status=403)
    
    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "Kullanıcı bulunamadı"}, status=404)
    
    role = request.data.get('role')
    if not role or role not in ['ADMIN', 'VET', 'WORKER']:
        return Response({"error": "Geçersiz rol. Seçenekler: ADMIN, VET, WORKER"}, status=400)
    
    # Update profile
    if hasattr(user, 'profile'):
        user.profile.role = role
        user.profile.save()
    else:
        UserProfile.objects.create(user=user, role=role)
    
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': role,
        'is_active': user.is_active,
    }, status=200)


@api_view(['GET', 'DELETE'])
def user_detail(request, id):
    """
    Kullanıcı detayını getir veya sil.
    Sadece ADMIN erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'ADMIN':
        return Response({"error": "Forbidden - Admin access required"}, status=403)
    
    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"error": "Kullanıcı bulunamadı"}, status=404)
    
    if request.method == 'GET':
        role = user.profile.role if hasattr(user, 'profile') else 'WORKER'
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': role,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
        }, status=200)
    
    elif request.method == 'DELETE':
        # Prevent self-deletion
        if user.id == request.user.id:
            return Response({"error": "Kendi hesabınızı silemezsiniz"}, status=400)
        
        user.delete()
        return Response({"message": "Kullanıcı silindi"}, status=200)


# ─────────────────────────────────────────────
#  HAYVANLAR (Animals) API
# ─────────────────────────────────────────────
@api_view(['GET'])
def animal_list(request):
    """
    Tüm hayvanları listele.
    Sadece giriş yapmış kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    animals = Animal.objects.all().order_by('-created_at')
    paginator = StandardResultsSetPagination()
    paginated_animals = paginator.paginate_queryset(animals, request)
    
    data = []
    for animal in paginated_animals:
        data.append({
            'id': animal.id,
            'ear_tag': animal.ear_tag,
            'name': animal.name,
            'birth_date': str(animal.birth_date) if animal.birth_date else None,
            'gender': animal.gender,
            'is_active': animal.is_active,
            'paddock': animal.paddock.name if animal.paddock else None,
            'paddock_id': animal.paddock_id,
            'created_at': animal.created_at.isoformat(),
            'device': animal.device.mac_address if hasattr(animal, 'device') else None,
        })
    return paginator.get_paginated_response(data)


@api_view(['POST'])
def animal_create(request):
    """
    Yeni hayvan oluştur.
    Sadece ADMIN ve VET kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    if not hasattr(request.user, 'profile') or request.user.profile.role not in ['ADMIN', 'VET']:
        return Response({"error": "Forbidden - Admin or Vet access required"}, status=403)
    
    ear_tag = request.data.get('ear_tag')
    if not ear_tag:
        return Response({"error": "ear_tag alanı gerekli"}, status=400)
    
    # Check if ear_tag already exists
    if Animal.objects.filter(ear_tag=ear_tag).exists():
        return Response({"error": "Bu küpe numarası zaten kullanılıyor"}, status=400)
    
    animal = Animal.objects.create(
        ear_tag=ear_tag,
        name=request.data.get('name', ''),
        birth_date=request.data.get('birth_date'),
        gender=request.data.get('gender', 'Female'),
        is_active=request.data.get('is_active', True),
        paddock_id=request.data.get('paddock_id', None)
    )
    
    return Response({
        'id': animal.id,
        'ear_tag': animal.ear_tag,
        'name': animal.name,
        'birth_date': str(animal.birth_date) if animal.birth_date else None,
        'gender': animal.gender,
        'is_active': animal.is_active,
        'paddock': animal.paddock.name if animal.paddock else None,
        'paddock_id': animal.paddock_id,
        'created_at': animal.created_at.isoformat(),
        'device': None,
    }, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
def animal_detail(request, id):
    """
    Hayvan detayını getir, güncelle veya sil.
    GET: Tüm giriş yapmış kullanıcılar
    PUT/DELETE: Sadece ADMIN ve VET
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    try:
        animal = Animal.objects.get(id=id)
    except Animal.DoesNotExist:
        return Response({"error": "Hayvan bulunamadı"}, status=404)
    
    if request.method == 'GET':
        return Response({
            'id': animal.id,
            'ear_tag': animal.ear_tag,
            'name': animal.name,
            'birth_date': str(animal.birth_date) if animal.birth_date else None,
            'gender': animal.gender,
            'is_active': animal.is_active,
            'paddock': animal.paddock.name if animal.paddock else None,
            'paddock_id': animal.paddock_id,
            'created_at': animal.created_at.isoformat(),
            'device': animal.device.mac_address if hasattr(animal, 'device') else None,
        }, status=200)
    
    elif request.method in ['PUT', 'DELETE']:
        # Only ADMIN and VET can update or delete
        if not hasattr(request.user, 'profile') or request.user.profile.role not in ['ADMIN', 'VET']:
            return Response({"error": "Forbidden - Admin or Vet access required"}, status=403)
        
        if request.method == 'PUT':
            # Update fields
            ear_tag = request.data.get('ear_tag')
            if ear_tag and ear_tag != animal.ear_tag:
                if Animal.objects.filter(ear_tag=ear_tag).exclude(id=animal.id).exists():
                    return Response({"error": "Bu küpe numarası zaten kullanılıyor"}, status=400)
                animal.ear_tag = ear_tag
            
            if 'name' in request.data:
                animal.name = request.data.get('name', '')
            if 'birth_date' in request.data:
                animal.birth_date = request.data.get('birth_date')
            if 'gender' in request.data:
                animal.gender = request.data.get('gender', 'Female')
            if 'is_active' in request.data:
                animal.is_active = request.data.get('is_active', True)
            if 'paddock_id' in request.data:
                val = request.data.get('paddock_id')
                animal.paddock_id = val if val else None
            
            animal.save()
            
            return Response({
                'id': animal.id,
                'ear_tag': animal.ear_tag,
                'name': animal.name,
                'birth_date': str(animal.birth_date) if animal.birth_date else None,
                'gender': animal.gender,
                'is_active': animal.is_active,
                'paddock': animal.paddock.name if animal.paddock else None,
                'paddock_id': animal.paddock_id,
                'created_at': animal.created_at.isoformat(),
                'device': animal.device.mac_address if hasattr(animal, 'device') else None,
            }, status=200)
        
        elif request.method == 'DELETE':
            animal.delete()
            return Response({"message": "Hayvan silindi"}, status=200)


# ─────────────────────────────────────────────
#  CİHAZ ATAMA (Device Assignment) API
# ─────────────────────────────────────────────
@api_view(['POST'])
def assign_animal_to_device(request):
    """
    Bir hayvanı bir cihaza (tasma) ata.
    Sadece giriş yapmış kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    mac_address = request.data.get('mac_address')
    ear_tag = request.data.get('ear_tag')
    
    if not mac_address or not ear_tag:
        return Response({"error": "mac_address ve ear_tag alanları gerekli"}, status=400)
    
    try:
        device = Device.objects.get(mac_address=mac_address)
    except Device.DoesNotExist:
        return Response({"error": "Cihaz bulunamadı"}, status=404)
    
    try:
        animal = Animal.objects.get(ear_tag=ear_tag)
    except Animal.DoesNotExist:
        return Response({"error": "Hayvan bulunamadı"}, status=404)
    
    # Check if animal is already assigned to another device
    if hasattr(animal, 'device') and animal.device:
        # Unassign from previous device
        animal.device.animal = None
        animal.device.save()
    
    # Assign animal to device
    device.animal = animal
    device.save()
    
    return Response({
        "message": f"Hayvan {animal.ear_tag} cihaza {device.mac_address} atandı",
        "device": {
            "mac_address": device.mac_address,
            "name": device.name,
            "animal": animal.ear_tag
        }
    }, status=200)


@api_view(['POST'])
def unassign_animal_from_device(request):
    """
    Bir cihazdan hayvan atamasını kaldır.
    Sadece giriş yapmış kullanıcılar erişebilir.
    """
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)
    
    mac_address = request.data.get('mac_address')
    
    if not mac_address:
        return Response({"error": "mac_address alanı gerekli"}, status=400)
    
    try:
        device = Device.objects.get(mac_address=mac_address)
    except Device.DoesNotExist:
        return Response({"error": "Cihaz bulunamadı"}, status=404)
    
    if device.animal:
        animal_name = device.animal.ear_tag
        device.animal = None
        device.save()
        return Response({
            "message": f"Cihaz {device.mac_address} için hayvan ataması kaldırıldı (önceki hayvan: {animal_name})"
        }, status=200)
    else:
        return Response({"message": "Bu cihazda atanmış hayvan yok"}, status=200)

@api_view(['GET'])
def dashboard_summary(request):
    """
    Dashboard için özet verileri döner:
    - total_active_animals: Aktif hayvan sayısı
    - excited_animals: Kızgın (excited_count > 0) aktif hayvan sayısı
    - total_steps: Tüm cihazların toplam adımı
    """
    # Aktif hayvanları say
    total_active_animals = Animal.objects.filter(is_active=True).count()

    # Bugün kızgınlık alarmı olan cihazları say
    bugun = date.today()
    alarm_activities = GunlukAktivite.objects.filter(
        tarih=bugun,
        kizginlik_alarm=True
    ).values_list('mac', flat=True)

    # Bu mac adreslerine sahip hayvanları say (cihazlar üzerinden)
    alarm_devices = Device.objects.filter(mac_address__in=alarm_activities)
    excited_animals = alarm_devices.filter(animal__is_active=True).count()

    # Tüm cihazların toplam adımını hesapla
    total_steps_result = Device.objects.aggregate(total=Sum('total_steps'))
    total_steps = total_steps_result['total'] or 0

    return Response({
        "total_active_animals": total_active_animals,
        "excited_animals": excited_animals,
        "total_steps": total_steps
    }, status=200)


# ─────────────────────────────────────────────
#  İZİN YÖNETİMİ API
# ─────────────────────────────────────────────
@api_view(['GET'])
def get_my_permissions(request):
    """Giriş yapan kullanıcının izin listesini döner."""
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)

    role = request.user.profile.role if hasattr(request.user, 'profile') else 'WORKER'
    RolePermission.initialize_defaults()
    permissions = RolePermission.get_permissions_for_role(role)
    return Response({
        "role": role,
        "permissions": permissions
    }, status=200)


@api_view(['GET'])
@require_permission('manage_users')
def get_all_permissions(request):
    """Tüm rollerin tüm izinlerini döner. Sadece admin."""
    RolePermission.initialize_defaults()

    result = {}
    for role_key, role_label in UserProfile.ROLE_CHOICES:
        perms = {}
        for perm_key, perm_label in ALL_PERMISSIONS:
            rp = RolePermission.objects.filter(role=role_key, permission_key=perm_key).first()
            perms[perm_key] = {
                "label": perm_label,
                "allowed": rp.is_allowed if rp else False,
                "locked": role_key == 'ADMIN'
            }
        result[role_key] = {
            "label": role_label,
            "permissions": perms
        }

    return Response(result, status=200)


@api_view(['POST'])
@require_permission('manage_users')
def update_permissions(request):
    """Bir rolün izinlerini toplu günceller. Sadece admin."""
    role = request.data.get('role')
    permissions = request.data.get('permissions', {})

    if not role or role not in dict(UserProfile.ROLE_CHOICES):
        return Response({"error": "Geçersiz rol"}, status=400)

    if role == 'ADMIN':
        return Response({"error": "Admin izinleri değiştirilemez"}, status=400)

    for perm_key, is_allowed in permissions.items():
        RolePermission.objects.update_or_create(
            role=role,
            permission_key=perm_key,
            defaults={'is_allowed': bool(is_allowed)}
        )

    return Response({"status": "success", "message": f"{role} izinleri güncellendi"}, status=200)


# ─────────────────────────────────────────────
#  PADOK YÖNETİMİ API
# ─────────────────────────────────────────────
@api_view(['GET'])
def paddock_list(request):
    """Tüm padokları listele (hayvan sayısı ile)."""
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)

    from django.db import models as db_models
    paddocks = Paddock.objects.filter(is_active=True).annotate(
        animal_count=Count('animals', filter=db_models.Q(animals__is_active=True))
    ).order_by('name')

    data = []
    for p in paddocks:
        data.append({
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'capacity': p.capacity,
            'animal_count': p.animal_count,
            'is_active': p.is_active,
            'created_at': p.created_at.isoformat(),
        })
    return Response(data, status=200)


@api_view(['POST'])
@require_permission('manage_paddocks')
def paddock_create(request):
    """Yeni padok oluştur."""
    name = request.data.get('name')
    if not name:
        return Response({"error": "Padok adı gerekli"}, status=400)

    if Paddock.objects.filter(name=name).exists():
        return Response({"error": "Bu isimde bir padok zaten var"}, status=400)

    paddock = Paddock.objects.create(
        name=name,
        description=request.data.get('description', ''),
        capacity=int(request.data.get('capacity', 0)),
    )

    return Response({
        'id': paddock.id,
        'name': paddock.name,
        'description': paddock.description,
        'capacity': paddock.capacity,
        'animal_count': 0,
        'is_active': paddock.is_active,
        'created_at': paddock.created_at.isoformat(),
    }, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
def paddock_detail(request, id):
    """Padok detay/güncelle/sil."""
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required"}, status=401)

    try:
        paddock = Paddock.objects.get(id=id)
    except Paddock.DoesNotExist:
        return Response({"error": "Padok bulunamadı"}, status=404)

    if request.method == 'GET':
        animal_count = paddock.animals.filter(is_active=True).count()
        animals_list = list(paddock.animals.filter(is_active=True).values('id', 'ear_tag', 'name', 'device__mac_address'))
        return Response({
            'id': paddock.id,
            'name': paddock.name,
            'description': paddock.description,
            'capacity': paddock.capacity,
            'animal_count': animal_count,
            'animals': animals_list,
            'is_active': paddock.is_active,
            'created_at': paddock.created_at.isoformat(),
        }, status=200)

    if not has_permission(request.user, 'manage_paddocks'):
        return Response({"error": "Bu işlem için yetkiniz yok"}, status=403)

    if request.method == 'PUT':
        if 'name' in request.data:
            new_name = request.data['name']
            if Paddock.objects.filter(name=new_name).exclude(id=paddock.id).exists():
                return Response({"error": "Bu isimde bir padok zaten var"}, status=400)
            paddock.name = new_name
        if 'description' in request.data:
            paddock.description = request.data['description']
        if 'capacity' in request.data:
            paddock.capacity = int(request.data['capacity'])
        if 'is_active' in request.data:
            paddock.is_active = request.data['is_active']
        paddock.save()
        return Response({
            'id': paddock.id,
            'name': paddock.name,
            'description': paddock.description,
            'capacity': paddock.capacity,
            'is_active': paddock.is_active,
        }, status=200)

    elif request.method == 'DELETE':
        paddock.is_active = False
        paddock.save()
        return Response({"message": "Padok pasife alındı"}, status=200)


# ─────────────────────────────────────────────
#  YAPAY DÖLLEME (Insemination) API
# ─────────────────────────────────────────────
@api_view(['GET'])
@require_permission('view_breeding')
def insemination_list(request):
    """Dölleme kayıtlarını listele (filtreli)."""
    queryset = Insemination.objects.select_related('animal', 'performed_by').all()

    status_filter = request.GET.get('status')
    animal_id = request.GET.get('animal_id')

    if status_filter:
        queryset = queryset.filter(status=status_filter)
    if animal_id:
        queryset = queryset.filter(animal_id=animal_id)

    data = []
    now = date.today()
    for ins in queryset[:100]:
        days_since = (now - ins.insemination_date.date()).days if ins.insemination_date else 0
        data.append({
            'id': ins.id,
            'animal': {
                'id': ins.animal.id,
                'ear_tag': ins.animal.ear_tag,
                'name': ins.animal.name,
            },
            'insemination_date': ins.insemination_date.isoformat(),
            'bull_info': ins.bull_info,
            'technician': ins.technician,
            'performed_by': ins.performed_by.username if ins.performed_by else None,
            'status': ins.status,
            'status_display': ins.get_status_display(),
            'days_since': days_since,
            'pregnancy_check_date': ins.pregnancy_check_date.isoformat() if ins.pregnancy_check_date else None,
            'expected_calving_date': ins.expected_calving_date.isoformat() if ins.expected_calving_date else None,
            'next_heat_expected': ins.next_heat_expected.isoformat() if ins.next_heat_expected else None,
            'actual_calving_date': ins.actual_calving_date.isoformat() if ins.actual_calving_date else None,
            'notes': ins.notes,
            'created_at': ins.created_at.isoformat(),
        })

    pending_count = Insemination.objects.filter(status='PENDING').count()
    success_count = Insemination.objects.filter(
        status='SUCCESS',
        updated_at__month=now.month, updated_at__year=now.year
    ).count()
    failed_count = Insemination.objects.filter(
        status='FAILED',
        updated_at__month=now.month, updated_at__year=now.year
    ).count()
    upcoming_checks = Insemination.objects.filter(
        status='PENDING',
        pregnancy_check_date__lte=now + timedelta(days=7),
        pregnancy_check_date__gte=now
    ).count()

    return Response({
        "results": data,
        "summary": {
            "pending": pending_count,
            "success_this_month": success_count,
            "failed_this_month": failed_count,
            "upcoming_checks": upcoming_checks,
        }
    }, status=200)


@api_view(['POST'])
@require_permission('manage_breeding')
def insemination_create(request):
    """Yeni dölleme kaydı oluştur."""
    animal_id = request.data.get('animal_id')
    insemination_date_str = request.data.get('insemination_date')

    if not animal_id or not insemination_date_str:
        return Response({"error": "animal_id ve insemination_date gerekli"}, status=400)

    try:
        animal = Animal.objects.get(id=animal_id)
    except Animal.DoesNotExist:
        return Response({"error": "Hayvan bulunamadı"}, status=404)

    ins_date = parse_datetime(insemination_date_str)
    if not ins_date:
        ins_date_d = parse_date(insemination_date_str)
        if ins_date_d:
            ins_date = timezone.make_aware(
                timezone.datetime.combine(ins_date_d, timezone.datetime.min.time())
            )
        else:
            return Response({"error": "Geçersiz tarih formatı"}, status=400)

    ins_date_only = ins_date.date() if hasattr(ins_date, 'date') else ins_date

    ins = Insemination.objects.create(
        animal=animal,
        insemination_date=ins_date,
        bull_info=request.data.get('bull_info', ''),
        technician=request.data.get('technician', ''),
        performed_by=request.user,
        status='PENDING',
        next_heat_expected=ins_date_only + timedelta(days=21),
        pregnancy_check_date=ins_date_only + timedelta(days=30),
        notes=request.data.get('notes', ''),
    )

    return Response({
        'id': ins.id,
        'animal': {'id': animal.id, 'ear_tag': animal.ear_tag, 'name': animal.name},
        'insemination_date': ins.insemination_date.isoformat(),
        'status': ins.status,
        'next_heat_expected': ins.next_heat_expected.isoformat(),
        'pregnancy_check_date': ins.pregnancy_check_date.isoformat(),
    }, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
@require_permission('view_breeding')
def insemination_detail(request, id):
    """Dölleme detay/güncelle/sil."""
    try:
        ins = Insemination.objects.select_related('animal', 'performed_by').get(id=id)
    except Insemination.DoesNotExist:
        return Response({"error": "Dölleme kaydı bulunamadı"}, status=404)

    if request.method == 'GET':
        days_since = (date.today() - ins.insemination_date.date()).days
        return Response({
            'id': ins.id,
            'animal': {'id': ins.animal.id, 'ear_tag': ins.animal.ear_tag, 'name': ins.animal.name},
            'insemination_date': ins.insemination_date.isoformat(),
            'bull_info': ins.bull_info,
            'technician': ins.technician,
            'performed_by': ins.performed_by.username if ins.performed_by else None,
            'status': ins.status,
            'status_display': ins.get_status_display(),
            'days_since': days_since,
            'pregnancy_check_date': ins.pregnancy_check_date.isoformat() if ins.pregnancy_check_date else None,
            'expected_calving_date': ins.expected_calving_date.isoformat() if ins.expected_calving_date else None,
            'next_heat_expected': ins.next_heat_expected.isoformat() if ins.next_heat_expected else None,
            'actual_calving_date': ins.actual_calving_date.isoformat() if ins.actual_calving_date else None,
            'notes': ins.notes,
        }, status=200)

    if not has_permission(request.user, 'manage_breeding'):
        return Response({"error": "Bu işlem için yetkiniz yok"}, status=403)

    if request.method == 'PUT':
        for field in ['bull_info', 'technician', 'notes']:
            if field in request.data:
                setattr(ins, field, request.data[field])
        if 'actual_calving_date' in request.data:
            ins.actual_calving_date = parse_date(request.data['actual_calving_date'])
        ins.save()
        return Response({"status": "updated"}, status=200)

    elif request.method == 'DELETE':
        ins.delete()
        return Response({"message": "Dölleme kaydı silindi"}, status=200)


@api_view(['PUT'])
@require_permission('manage_breeding')
def insemination_update_status(request, id):
    """Dölleme durumunu güncelle (Tuttu/Tutmadı)."""
    try:
        ins = Insemination.objects.get(id=id)
    except Insemination.DoesNotExist:
        return Response({"error": "Dölleme kaydı bulunamadı"}, status=404)

    new_status = request.data.get('status')
    if new_status not in ['SUCCESS', 'FAILED', 'CANCELLED']:
        return Response({"error": "Geçersiz durum. SUCCESS, FAILED veya CANCELLED olmalı"}, status=400)

    ins.status = new_status

    if new_status == 'SUCCESS':
        ins.expected_calving_date = ins.insemination_date.date() + timedelta(days=280)
        ins.next_heat_expected = None
    elif new_status == 'FAILED':
        ins.next_heat_expected = date.today() + timedelta(days=21)
        ins.expected_calving_date = None

    if 'notes' in request.data:
        ins.notes = request.data['notes']

    ins.save()

    return Response({
        "status": ins.status,
        "status_display": ins.get_status_display(),
        "expected_calving_date": ins.expected_calving_date.isoformat() if ins.expected_calving_date else None,
        "next_heat_expected": ins.next_heat_expected.isoformat() if ins.next_heat_expected else None,
    }, status=200)


@api_view(['GET'])
@require_permission('view_breeding')
def animal_breeding_history(request, id):
    """Bir hayvanın tüm dölleme geçmişi."""
    try:
        animal = Animal.objects.get(id=id)
    except Animal.DoesNotExist:
        return Response({"error": "Hayvan bulunamadı"}, status=404)

    inseminations = Insemination.objects.filter(animal=animal).order_by('-insemination_date')
    data = []
    for ins in inseminations:
        data.append({
            'id': ins.id,
            'insemination_date': ins.insemination_date.isoformat(),
            'bull_info': ins.bull_info,
            'technician': ins.technician,
            'status': ins.status,
            'status_display': ins.get_status_display(),
            'expected_calving_date': ins.expected_calving_date.isoformat() if ins.expected_calving_date else None,
            'actual_calving_date': ins.actual_calving_date.isoformat() if ins.actual_calving_date else None,
            'notes': ins.notes,
        })

    return Response({
        "animal": {"id": animal.id, "ear_tag": animal.ear_tag, "name": animal.name},
        "total_inseminations": len(data),
        "success_count": sum(1 for d in data if d['status'] == 'SUCCESS'),
        "history": data,
    }, status=200)
