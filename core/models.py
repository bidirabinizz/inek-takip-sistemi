from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin (Patron)'),
        ('VET', 'Veteriner'),
        ('WORKER', 'İşçi'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='WORKER')

    class Meta:
        db_table = 'UserProfile'

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()


class Animal(models.Model):
    ear_tag     = models.CharField(max_length=50, unique=True)
    name        = models.CharField(max_length=100, blank=True, default="")
    birth_date  = models.DateField(null=True, blank=True)
    gender      = models.CharField(max_length=20, default='Female')
    is_active   = models.BooleanField(default=True)
    paddock     = models.CharField(max_length=50, blank=True, null=True)  # Yeni alan: Padok
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'Animal'

    def __str__(self):
        return f"{self.ear_tag} | {self.name}"


class AccelerometerData(models.Model):
    device_mac      = models.CharField(max_length=50, default="BİLİNMEYEN_CİHAZ")
    x               = models.FloatField()
    y               = models.FloatField()
    z               = models.FloatField()
    signal_strength = models.IntegerField(null=True)
    created_at      = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'AccelerometerData'

    def __str__(self):
        return f"{self.device_mac} | {self.created_at}"


class Device(models.Model):
    mac_address = models.CharField(max_length=50, unique=True)
    name        = models.CharField(max_length=100, blank=True, default="")
    animal      = models.OneToOneField(Animal, on_delete=models.SET_NULL, null=True, blank=True, related_name='device')
    location    = models.CharField(max_length=50, blank=True, default="")
    total_steps = models.IntegerField(default=0)
    last_seen   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Device'

    def __str__(self):
        animal_name = self.animal.name if self.animal else "No Animal"
        return f"{self.name or self.mac_address} | {animal_name} | {self.total_steps} adım"


class GunlukAktivite(models.Model):
    mac             = models.CharField(max_length=50)
    tarih           = models.DateField()
    toplam_adim     = models.IntegerField(default=0)
    excited_count   = models.IntegerField(default=0)
    ortalama_mag    = models.FloatField(default=0)
    max_mag         = models.FloatField(default=0)
    gece_adim       = models.IntegerField(default=0)
    kizginlik_skoru = models.FloatField(default=0)
    kizginlik_alarm = models.BooleanField(default=False)
    yatma_suresi_dk = models.IntegerField(default=0)
    last_activity = models.CharField(max_length=20, default="UNKNOWN")
    last_activity_time = models.DateTimeField(null=True, blank=True)
    # ── Canlı yatma takibi için ──────────────────
    # Inek yatmaya başladığında bu alana zaman damgası yazılır.
    # Kalktığında süre hesaplanıp yatma_suresi_dk'ya eklenir,
    # bu alan null yapılır. Böylece tüm cihazlar aynı veriyi görür.
    lying_start_time = models.DateTimeField(null=True, blank=True)
    still_start_time = models.DateTimeField(null=True, blank=True) # YENİ EKLENEN KRONOMETRE
    
    class Meta:
        db_table        = 'GunlukAktivite'
        unique_together = ("mac", "tarih")

    def __str__(self):
        return f"{self.mac} | {self.tarih} | Skor: {self.kizginlik_skoru}"

    @property
    def current_lying_mins(self):
        """Şu an yatıyorsa anlık toplam yatma süresini döner."""
        total = self.yatma_suresi_dk
        if self.lying_start_time:
            elapsed = int((timezone.now() - self.lying_start_time).total_seconds() / 60)
            total += elapsed
        return total


class SystemSettings(models.Model):
    """
    Singleton model - her zaman tek bir kayıt olacak.
    Aktivite tanıma algoritmasının eşik değerlerini saklar.
    """
    EXCITED_MAG = models.FloatField(default=25.0)
    WALK_STD_MIN = models.FloatField(default=2.0)
    WALK_STD_MAX = models.FloatField(default=15.0)
    WALK_PEAKS_MIN = models.IntegerField(default=1)
    STILL_STD_MAX = models.FloatField(default=2.0)
    STILL_MAG_MIN = models.FloatField(default=7.5)
    STILL_MAG_MAX = models.FloatField(default=12.5)
    LYING_STILL_MIN_MINUTES = models.IntegerField(default=2)
    LYING_NIGHT_START = models.IntegerField(default=22)
    LYING_NIGHT_END = models.IntegerField(default=6)
    MAG_PEAK_THRESHOLD = models.FloatField(default=11.5)
    MAG_VALLEY_THRESHOLD = models.FloatField(default=9.5)
    COOLDOWN_MS = models.IntegerField(default=650)
    WINDOW_SIZE = models.IntegerField(default=5)
    FETCH_INTERVAL_MS = models.IntegerField(default=700)

    class Meta:
        db_table = 'SystemSettings'

    def __str__(self):
        return "System Settings (Singleton)"

    @classmethod
    def get_instance(cls):
        """Singleton pattern: her zaman tek kayıt döner"""
        instance, created = cls.objects.get_or_create(pk=1)
        return instance

    def to_dict(self):
        """Ayarları dictionary olarak döner"""
        return {
            'EXCITED_MAG': self.EXCITED_MAG,
            'WALK_STD_MIN': self.WALK_STD_MIN,
            'WALK_STD_MAX': self.WALK_STD_MAX,
            'WALK_PEAKS_MIN': self.WALK_PEAKS_MIN,
            'STILL_STD_MAX': self.STILL_STD_MAX,
            'STILL_MAG_MIN': self.STILL_MAG_MIN,
            'STILL_MAG_MAX': self.STILL_MAG_MAX,
            'LYING_STILL_MIN_MINUTES': self.LYING_STILL_MIN_MINUTES,
            'LYING_NIGHT_START': self.LYING_NIGHT_START,
            'LYING_NIGHT_END': self.LYING_NIGHT_END,
            'MAG_PEAK_THRESHOLD': self.MAG_PEAK_THRESHOLD,
            'MAG_VALLEY_THRESHOLD': self.MAG_VALLEY_THRESHOLD,
            'COOLDOWN_MS': self.COOLDOWN_MS,
            'WINDOW_SIZE': self.WINDOW_SIZE,
            'FETCH_INTERVAL_MS': self.FETCH_INTERVAL_MS,
        }
