from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import AccelerometerData

class Command(BaseCommand):
    help = '24 saatten eski sensör verilerini temizler'

    def handle(self, *args, **options):
        # 24 saat önceki tarih
        cutoff = timezone.now() - timedelta(hours=24)
        
        # Silinecek kayıt sayısını bul
        old_records = AccelerometerData.objects.filter(created_at__lt=cutoff)
        count = old_records.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Silinecek eski kayıt bulunamadı.'))
            return
        
        # Sil
        old_records.delete()
        
        self.stdout.write(
            self.style.SUCCESS(f'Başarıyla {count} eski kayıt silindi (24 saatten eski).')
        )