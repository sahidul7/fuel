import axios from 'axios';

const BASE = 'http://localhost:5000/api';

export const api = {
  summary:  () => axios.get(`${BASE}/summary`).then(r => r.data),
  heatmap:  (fuel='all') => axios.get(`${BASE}/heatmap?fuel=${fuel}`).then(r => r.data),
  stations: () => axios.get(`${BASE}/stations`).then(r => r.data),
  forecast: (stationId) => axios.get(`${BASE}/forecast/${stationId}`).then(r => r.data),
  alerts:   () => axios.get(`${BASE}/alerts`).then(r => r.data),
  upazila:  (id) => axios.get(`${BASE}/upazila/${id}`).then(r => r.data),
};
