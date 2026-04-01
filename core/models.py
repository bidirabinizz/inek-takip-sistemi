from django.db import models
from django.utils import timezone


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
    cow_id      = models.CharField(max_length=20, blank=True, default="")
    location    = models.CharField(max_length=50, blank=True, default="")
    total_steps = models.IntegerField(default=0)
    last_seen   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Device'

    def __str__(self):
        return f"{self.name or self.mac_address} | {self.total_steps} adım"


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
