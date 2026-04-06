// Activity state translations and color mapping
export const ACTIVITY_TRANSLATIONS = {
  'KIZGINLIK': 'Kızgınlık',
  'YÜRÜYOR': 'Yürüyor',
  'YATIYOR': 'Yatıyor',
  'Durağan / Ayakta': 'Durağan / Ayakta',
  'EXCITED': 'Kızgınlık',
  'WALKING': 'Yürüyor',
  'LYING': 'Yatıyor',
  'STANDING': 'Durağan / Ayakta',
  'STILL': 'Durağan / Ayakta',
  'UNKNOWN': 'Bilinmiyor',
};

export const ACTIVITY_COLORS = {
  'KIZGINLIK': '#f87171',  // Red - excited
  'YÜRÜYOR': '#00ffb4',    // Green - walking
  'YATIYOR': '#818cf8',    // Purple - lying/sleeping
  'Durağan / Ayakta': '#fbbf24', // Yellow - standing/still
  'EXCITED': '#f87171',
  'WALKING': '#00ffb4',
  'LYING': '#818cf8',
  'STANDING': '#fbbf24',
  'STILL': '#fbbf24',
  'UNKNOWN': '#6b7280',    // Gray - unknown
};

export const getActivityLabel = (activity) => {
  return ACTIVITY_TRANSLATIONS[activity] || activity || 'Bilinmiyor';
};

export const getActivityColor = (activity) => {
  return ACTIVITY_COLORS[activity] || ACTIVITY_COLORS.UNKNOWN;
};
