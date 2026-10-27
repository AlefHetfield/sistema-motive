const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1d2b36' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#18232e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b3c2ce' }] },
  { elementType: 'labels.icon', stylers: [{ saturation: -65 }, { lightness: -10 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#526474' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#22323c' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#203a34' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9bb8a6' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#344653' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#18232e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#c1ced8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#59636b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#263845' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2b3c47' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#122e41' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#86a9c3' }] },
];

export const propertyMapThemeOptions = theme => ({
  styles: theme === 'dark' ? darkMapStyles : null,
  backgroundColor: theme === 'dark' ? '#18232e' : '#e5e7eb',
});
