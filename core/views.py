from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import AccelerometerData, Device, GunlukAktivite
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.timezone import make_aware, is_naive, localtime
from datetime import date, timedelta


# ─────────────────────────────────────────────
#  SENSÖR API
# ─────────────────────────────────────────────
@api_view(['POST', 'GET'])
def sensor_api(request):
    if request.method == 'POST':
        data = request.data

        def sync_device(mac):
            if mac:
                Device.objects.get_or_create(mac_address=mac, defaults={'name': f"İnek-{mac[:8].upper()}"})

        if isinstance(data, list):
            if len(data) > 0:
                sync_device(data[0].get('mac'))
            
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

                records.append(
                    AccelerometerData(
                        device_mac=item.get('mac', 'BİLİNMEYEN_CİHAZ'),
                        x=item.get('x'), y=item.get('y'), z=item.get('z'),
                        signal_strength=item.get('rssi'),
                        created_at=created_time 
                    )
                )
            
            AccelerometerData.objects.bulk_create(records)
            return Response({"status": "success", "count": len(records)}, status=201)
            
        else:
            sync_device(data.get('mac'))
            
            zaman_str = data.get('zaman')
            created_time = timezone.now()
            if zaman_str:
                parsed_time = parse_datetime(zaman_str.replace(' ', 'T'))
                if parsed_time:
                    if is_naive(parsed_time):
                        parsed_time = make_aware(parsed_time)
                    created_time = parsed_time

            AccelerometerData.objects.create(
                device_mac=data.get('mac', 'BİLİNMEYEN_CİHAZ'),
                x=data.get('x'), y=data.get('y'), z=data.get('z'),
                signal_strength=data.get('rssi'),
                created_at=created_time 
            )
            return Response({"status": "success"}, status=201)

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
@api_view(['GET'])
def get_devices(request):
    devices = Device.objects.all().order_by('-last_seen')
    res = [
        {
            "mac": d.mac_address,
            "name": d.name,
            "cow_id": d.cow_id,
            "location": d.location,
            "total_steps": d.total_steps,
            "last_seen": d.last_seen
        }
        for d in devices
    ]
    return Response(res)


# ─────────────────────────────────────────────
#  ADIM GÜNCELLEME
# ─────────────────────────────────────────────
@api_view(['POST'])
def update_device_steps(request):
    mac       = request.data.get('mac')
    new_steps = request.data.get('steps', 0)
    if mac:
        device, _ = Device.objects.get_or_create(mac_address=mac)
        device.total_steps += int(new_steps)
        device.save()
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

    kayit, _ = GunlukAktivite.objects.get_or_create(mac=mac, tarih=bugun)

    kayit.toplam_adim   += steps
    kayit.excited_count += (1 if raw_activity == "EXCITED" else 0)
    if gece_mi:
        kayit.gece_adim += steps
    if steps == 0 and raw_activity in ["WALKING", "EXCITED"]:
        raw_activity = "STILL"

    # STILL kronometresi
    if raw_activity == "STILL":
        if not kayit.still_start_time:
            if data_start:
                parsed = parse_datetime(data_start)
                kayit.still_start_time = parsed if parsed else now
            else:
                kayit.still_start_time = now
    else:
        if kayit.still_start_time:
            kayit.still_start_time = None
            
        if kayit.lying_start_time:
            elapsed = int((now - kayit.lying_start_time).total_seconds() / 60)
            kayit.yatma_suresi_dk += elapsed
            kayit.lying_start_time = None

    # LYING yönetimi
    still_mins = 0
    if kayit.still_start_time:
        ref_time   = parse_datetime(data_end) if data_end else now
        still_mins = int((ref_time - kayit.still_start_time).total_seconds() / 60)

    is_lying = gece_mi or (raw_activity == "STILL" and still_mins >= 10)

    if is_lying:
        if not kayit.lying_start_time:
            kayit.lying_start_time = kayit.still_start_time or now
    else:
        if kayit.lying_start_time:
            elapsed = int((now - kayit.lying_start_time).total_seconds() / 60)
            kayit.yatma_suresi_dk += elapsed
            kayit.lying_start_time = None

    # Final aktivite kararı
    if raw_activity == "EXCITED":
        final_activity = "EXCITED"
    elif raw_activity == "WALKING":
        final_activity = "WALKING"
    elif is_lying:
        final_activity = "LYING"
    elif raw_activity == "STILL":
        final_activity = "STANDING"
    else:
        final_activity = "UNKNOWN"

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
            "final_activity": "UNKNOWN",
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
                final_activity = "LYING"
            elif kayit.still_start_time:
                saat = now.hour
                gece_mi = saat >= 22 or saat < 6
                if gece_mi or still_mins >= 10:
                    final_activity = "LYING"
                else:
                    final_activity = "STANDING"
            else:
                final_activity = "UNKNOWN"
    else:
        # Hiç kayıt yoksa UNKNOWN
        final_activity = "UNKNOWN"

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
        
        devices = Device.objects.all()
        res_data = []

        for d in devices:
            aktivite = GunlukAktivite.objects.filter(mac=d.mac_address, tarih=bugun).first()
            
            # 🚀 EMNİYET KİLİDİ: last_seen None ise hata vermesin
            is_online = False
            if d.last_seen:
                diff = (timezone.now() - d.last_seen).total_seconds()
                is_online = diff < 300 

            item = {
                "mac": d.mac_address,
                "name": d.name if d.name else f"İnek-{d.mac_address[:6].upper()}",
                "cow_id": d.cow_id,
                "kizginlik_skoru": aktivite.kizginlik_skoru if aktivite else 0,
                "total_steps": d.total_steps,
                "status": "online" if is_online else "offline",
                "alarm": aktivite.kizginlik_alarm if aktivite else False
            }
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
