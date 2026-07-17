export const MAP_CONFIG = {
  provider: 'leaflet' as 'leaflet' | 'mapbox',
  leaflet: {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  mapbox: {
    accessToken: '',
    style: 'mapbox://styles/mapbox/dark-v11',
    maxZoom: 22,
  },
  // Default bounds for Bangalore
  defaultCenter: [12.9716, 77.5946] as [number, number],
  defaultZoom: 11,
  minZoom: 9,
  maxZoom: 16,
};
