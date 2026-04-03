from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import AccelerometerData

class Command(BaseCommand):
    help = '7 günden eski sensör verilerini temizler'

    def handle(self, *args, **options):
        # 7 gün önceki tarih
        cutoff_date = timezone.now() - timedelta(days=7)
        
        # Silinecek kayıt sayısını bul
        old_records = AccelerometerData.objects.filter(created_at__lt=cutoff_date)
        count = old_records.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Silinecek eski kayıt bulunamadı.'))
            return
        
        # Sil
        old_records.delete()
        
        self.stdout.write(
            self.style.SUCCESS(f'Başarıyla {count} eski kayıt silindi (7 günden eski).')
        )