from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import AccelerometerData, Device, GunlukAktivite, SystemSettings, Animal, UserProfile
from django.contrib.auth.models import User
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
    res = []
    for d in devices:
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


api_view(['POST'])
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
    data = []
    for animal in animals:
        data.append({
            'id': animal.id,
            'ear_tag': animal.ear_tag,
            'name': animal.name,
            'birth_date': animal.birth_date.isoformat() if animal.birth_date else None,
            'gender': animal.gender,
            'is_active': animal.is_active,
            'created_at': animal.created_at.isoformat(),
            'device': animal.device.mac_address if hasattr(animal, 'device') else None,
        })
    return Response(data, status=200)


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
        is_active=request.data.get('is_active', True)
    )
    
    return Response({
        'id': animal.id,
        'ear_tag': animal.ear_tag,
        'name': animal.name,
        'birth_date': animal.birth_date.isoformat() if animal.birth_date else None,
        'gender': animal.gender,
        'is_active': animal.is_active,
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
            'birth_date': animal.birth_date.isoformat() if animal.birth_date else None,
            'gender': animal.gender,
            'is_active': animal.is_active,
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
            
            animal.save()
            
            return Response({
                'id': animal.id,
                'ear_tag': animal.ear_tag,
                'name': animal.name,
                'birth_date': animal.birth_date.isoformat() if animal.birth_date else None,
                'gender': animal.gender,
                'is_active': animal.is_active,
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

# excited_count > 0 olan aktif hayvanları say (GunlukAktivite'den bugünkü)
bugun = date.today()
excited_activities = GunlukAktivite.objects.filter(
    tarih=bugun,
    excited_count__gt=0
).values_list('mac', flat=True)

# Bu mac adreslerine sahip hayvanları say (cihazlar üzerinden)
excited_devices = Device.objects.filter(mac_address__in=excited_activities)
excited_animals = excited_devices.filter(animal__is_active=True).count()

# Tüm cihazların toplam adımını hesapla
total_steps_result = Device.objects.aggregate(total=Sum('total_steps'))
total_steps = total_steps_result['total'] or 0

return Response({
    "total_active_animals": total_active_animals,
    "excited_animals": excited_animals,
    "total_steps": total_steps
}, status=200)
