import api from './api';

export const fetchSummaryData = async () => {
  const { data } = await api.get('/api/dashboard-summary/');
  return data;
};

export const fetchAlarmDevicesData = async () => {
  const { data } = await api.get('/api/cihazlar-heatmap/?alert=has_alarm');
  return data;
};

export const fetchActivityStatus = async (mac) => {
  const { data } = await api.get(`/api/aktivite-durum/?mac=${mac}`);
  return data;
};

export const fetchDeviceNamesData = async () => {
  const { data } = await api.get('/api/cihazlar/');
  return data;
};

export const fetchLiveSensorData = async () => {
  const { data } = await api.get('/api/gercek-sensor/');
  return data;
};

export const updateDeviceSteps = async (mac, steps) => {
  const { data } = await api.post('/api/cihaz-guncelle/', { mac, steps });
  return data;
};

export const updateActivityData = async (payload) => {
  const { data } = await api.post('/api/aktivite-guncelle/', payload);
  return data;
};
