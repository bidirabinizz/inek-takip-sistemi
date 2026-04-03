#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# core/activity_processor.py
# Türkiye'de küzgünlükşççi için aktivite tespiti için Python modülü

import math
from django.db.models import F
from core.models import SystemSettings, GunlukAktivite, Device
from django.utils import timezone

# SystemSettings'den dinamik eçilçleri al
settings = SystemSettings.get_instance()

# Özelçlik fonksiyonlarí
def movingAverage(data, window_size):
    """Yatay hareket ortalaması
    Args:
        data (list): X, Y, Z veriler
        window_size (int): Açıklama añı
    Returns:
        float: Yatay hareket ortalaması
    """
    if len(data) < window_size:
        return sum(data) / len(data) if data else 0
    return sum(data[-window_size:]) / window_size

def stdDev(data):
    """Standart sapma hesaplaması
    """
    if not data:
        return 0
    mean_val = sum(data) / len(data)
    variance = sum((x - mean_val) ** 2 for x in data) / len(data)
    return math.sqrt(variance)

def detectSteps(mag_values, threshold):
    """Adım tespiti
    Args:
        mag_values (list): Magnitude degerleri
        threshold (float): Eçilçme eçiklimi
    Returns:
        int: Adım sayısı
    """
    count = 0
    for i in range(1, len(mag_values)):
        if mag_values[i] > threshold and mag_values[i-1] < threshold:
            count += 1
    return count

def classifyActivityRaw(x, y, z, mag, settings):
    """Aktivité tülumlüğı
    Args:
        x, y, z (float): Sensör verileri
        mag (float): Magnitude
        settings (object): SystemSettings instance
    Returns:
        tuple: (activity_type, steps, excited_count)
    """
    # Yatay hareket hesaplama
    horizontal = math.sqrt(x**2 + y**2)
    # Yatay hareket ortalaması
    horiz_avg = movingAverage([horizontal] * settings.WINDOW_SIZE, settings.WINDOW_SIZE)
    # Standart sapma
    horiz_std = stdDev([horizontal] * settings.WINDOW_SIZE)
    # Magnitude eçiklimi
    mag_peak = max(mag) if mag else 0
    # Adım tespiti
    steps = detectSteps([mag] * settings.WINDOW_SIZE, settings.MAG_PEAK_THRESHOLD)
    # Küzgünlük tespiti
    excited = 1 if mag_peak > settings.EXCITED_MAG else 0
    # Aktivite tülumlüğı
    if excited > 0:
        return ('Küzgünlük', steps, excited)
    elif horiz_std > settings.WALK_STD_MAX:
        return ('Yürünyor', steps, 0)
    elif horiz_std < settings.WALK_STD_MIN:
        return ('Açıkta Durağan', steps, 0)
    else:
        return ('Yürünmayan', steps, 0)