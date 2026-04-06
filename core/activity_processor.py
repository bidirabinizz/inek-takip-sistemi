#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# core/activity_processor.py
# Türkiye'de küzgünlükşççi için aktivite tespiti için Python modülü

import math
from django.db.models import F
from core.models import SystemSettings, GunlukAktivite, Device
from django.utils import timezone

# SystemSettings'den dinamik eçilçleri al

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
    """Handles both scalar and list inputs for batch processing.
    Args:
        x, y, z (float or list): Sensor values
        mag (float or list): Magnitude
        settings (object): SystemSettings instance
    Returns:
        tuple: (activity_type, steps, excited_count)
    """
    # Ensure inputs are lists
    if not isinstance(x, list):
        x = [x]
    if not isinstance(y, list):
        y = [y]
    if not isinstance(z, list):
        z = [z]
    if not isinstance(mag, list):
        mag = [mag]
    # Yatay hareket hesaplama
    horizontal = [math.sqrt(xi**2 + yi**2) for xi, yi in zip(x, y)]
    # Yatay hareket ortalaması
    horiz_avg = movingAverage(horizontal, settings.WINDOW_SIZE)
    # Standart sapma
    horiz_std = stdDev(horizontal)
    # Magnitude eçiklimi
    mag_peak = max(mag) if mag else 0
    # Adım tespiti
    steps = detectSteps(mag, settings.MAG_PEAK_THRESHOLD)
    # Küzgünlük tespiti
    excited = 1 if mag_peak > settings.EXCITED_MAG else 0
    # Aktivite tülumlüğı
    if excited > 0:
        return ('EXCITED', steps, excited)
    elif horiz_std > settings.WALK_STD_MAX:
        return ('WALKING', steps, 0)
    elif horiz_std < settings.WALK_STD_MIN:
        return ('STILL', steps, 0)
    else:
        return ('STILL', steps, 0)