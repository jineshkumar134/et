import numpy as np
import math
from datetime import datetime, timezone
from backend.services.source_attribution_service import SourceAttributionAgent, get_city_gis_layers

# In-memory database for inspection tasks to allow updates & persistence during the session
INSPECTION_STORE = {}

class EnforcementEngine:
    """Enforcement Intelligence Agent that prioritizes interventions and clusters hotspots into routes."""
    
    def __init__(self):
        self.attribution_agent = SourceAttributionAgent()

    def get_city_recommendations(self, city: str, forecast_service, resolution: str = '1km') -> list:
        """Generates dynamic, non-hardcoded enforcement actions positioned within the city boundaries."""
        # Fetch forecasts
        try:
            forecasts = forecast_service.get_all_forecasts('current')
        except Exception:
            return []
            
        recommendations = []
        
        # Bounding coordinates mapping
        bounds_map = {
            'delhi': {'lat_min': 28.500, 'lat_max': 28.800, 'lon_min': 77.000, 'lon_max': 77.300, 'lat_center': 28.6139, 'lon_center': 77.2090},
            'mumbai': {'lat_min': 18.900, 'lat_max': 19.300, 'lon_min': 72.700, 'lon_max': 73.000, 'lat_center': 19.0760, 'lon_center': 72.8777},
            'bengaluru': {'lat_min': 12.834, 'lat_max': 13.143, 'lon_min': 77.460, 'lon_max': 77.780, 'lat_center': 12.9716, 'lon_center': 77.5946},
            'chennai': {'lat_min': 12.900, 'lat_max': 13.200, 'lon_min': 80.150, 'lon_max': 80.300, 'lat_center': 13.0827, 'lon_center': 80.2707},
            'kolkata': {'lat_min': 22.400, 'lat_max': 22.700, 'lon_min': 88.300, 'lon_max': 88.450, 'lat_center': 22.5726, 'lon_center': 88.3639},
            'hyderabad': {'lat_min': 17.300, 'lat_max': 17.600, 'lon_min': 78.350, 'lon_max': 78.600, 'lat_center': 17.3850, 'lon_center': 78.4867},
            'ahmedabad': {'lat_min': 22.900, 'lat_max': 23.150, 'lon_min': 72.500, 'lon_max': 72.700, 'lat_center': 23.0225, 'lon_center': 72.5714},
            'pune': {'lat_min': 18.400, 'lat_max': 18.700, 'lon_min': 73.750, 'lon_max': 74.000, 'lat_center': 18.5204, 'lon_center': 73.8567}
        }
        b = bounds_map.get(city.lower(), bounds_map['bengaluru'])
        lat_step = (b['lat_max'] - b['lat_min']) / 20
        lon_step = (b['lon_max'] - b['lon_min']) / 20
        
        gis_layers = get_city_gis_layers(city.lower(), b['lat_center'], b['lon_center'])
        
        for g in forecasts:
            # Only generate recommendations for polluted areas (AQI > 100)
            if g['aqi'] < 100:
                continue
                
            # Calculate coordinates matching city boundaries
            row = g['grid_id'] // 20
            col = g['grid_id'] % 20
            
            lat_min = b['lat_min'] + row * lat_step
            lat_max = lat_min + lat_step
            lon_min = b['lon_min'] + col * lon_step
            lon_max = lon_min + lon_step
            
            g_lat = (lat_min + lat_max) / 2
            g_lon = (lon_min + lon_max) / 2
                
            # Fetch explainable source attribution breakdown using correct coordinates
            attr = self.attribution_agent.compute_attribution(
                grid_id=g['grid_id'],
                lat=g_lat,
                lon=g_lon,
                city=city,
                aqi=g['aqi']
            )
            
            # Determine dominant source
            dominant_contrib = max(attr['contributions'], key=lambda c: c['percentage'])
            dominant_source = dominant_contrib['source']
            dominant_pct = dominant_contrib['percentage']
            
            # Priority Score Calculation
            base_score = g['aqi'] * 0.25 # AQI contribution
            trend_bonus = 15.0 if g['trend'] == 'Increasing' else (0.0 if g['trend'] == 'Stable' else -10.0)
            
            # Proximity to schools and hospitals
            vulnerable_near = 0
            for src in attr['nearby_sources']:
                if src['type'] in ['School', 'Hospital', 'CAAQMS Station'] and src['distance_km'] < 2.0:
                    vulnerable_near += 1
            vulnerable_bonus = min(vulnerable_near * 8.0, 25.0)
            
            # Simulated previous complaints score
            complaints_factor = (g['grid_id'] % 5) * 6.0
            
            priority_score = float(np.clip(base_score + trend_bonus + vulnerable_bonus + complaints_factor, 10, 100))
            
            # Classify Priority Level
            if priority_score >= 75:
                priority = 'Critical'
            elif priority_score >= 55:
                priority = 'High'
            elif priority_score >= 35:
                priority = 'Medium'
            else:
                priority = 'Low'
                
            # Dynamic Action Selection based on source
            department = "CPCB Enforcement Division"
            suggested_action = "Routine inspection of localized grids."
            impact_reduction = "8-12%"
            inspection_time = "45 mins"
            urgency = "Normal"
            
            if dominant_source == 'Traffic':
                suggested_action = "Deploy Traffic Police officers to coordinate route diversion. Direct municipal team to restrict heavy commercial diesel vehicles in this sector."
                department = "Urban Traffic Police & Municipal Transit Authority"
                impact_reduction = f"{int(dominant_pct * 0.4)}% AQI reduction"
                inspection_time = "60 mins"
                urgency = "Immediate"
            elif dominant_source == 'Industry':
                suggested_action = "Conduct emission sampling of industrial stack. Verify compliance certificates and active pollution control scrubber units."
                department = "State Pollution Control Board (SPCB) Air Wing"
                impact_reduction = f"{int(dominant_pct * 0.45)}% AQI reduction"
                inspection_time = "90 mins"
                urgency = "High"
            elif dominant_source == 'Construction':
                suggested_action = "Issue Dust Control Notice. Inspect active construction permits site to verify water sprinkling and windbreaker dust screens."
                department = "Municipal Building Inspectorate"
                impact_reduction = f"{int(dominant_pct * 0.35)}% AQI reduction"
                inspection_time = "45 mins"
                urgency = "High"
            elif dominant_source == 'Waste Burning':
                suggested_action = "Dispatch municipal team to extinguish solid waste burning. Clear secondary refuse storage depot and issue penalty notices."
                department = "Municipal Solid Waste Management Dept"
                impact_reduction = f"{int(dominant_pct * 0.5)}% AQI reduction"
                inspection_time = "30 mins"
                urgency = "Immediate"
            elif dominant_source == 'Dust':
                suggested_action = "Deploy mechanical road sweeping machines and deploy smog dust guns to spray water mist."
                department = "Public Works Department (PWD)"
                impact_reduction = f"{int(dominant_pct * 0.3)}% AQI reduction"
                inspection_time = "30 mins"
                urgency = "Medium"
                
            # Fetch / Initialize Inspection Task Status
            task_key = f"{city.lower()}_{g['grid_id']}"
            if task_key not in INSPECTION_STORE:
                INSPECTION_STORE[task_key] = {
                    'status': 'Pending',
                    'assigned_inspector': '—',
                    'compliance_notes': '',
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }
            task_state = INSPECTION_STORE[task_key]
            
            # Combine reasons and evidence
            reasons = f"High contribution from {dominant_source} ({dominant_pct}%). "
            if vulnerable_near > 0:
                reasons += f"Vulnerable receptors ({vulnerable_near} schools/hospitals) inside the 2km grid zone."
                
            recommendations.append({
                'grid_id': g['grid_id'],
                'ward': f"Ward {((g['grid_id'] % 25) + 1)}",
                'lat': g_lat,
                'lon': g_lon,
                'current_aqi': round(g['current_aqi']),
                'forecast_aqi': round(g['aqi_24h']),
                'primary_source': dominant_source,
                'priority': priority,
                'priority_score': round(priority_score),
                'reason': reasons,
                'suggested_action': suggested_action,
                'department': department,
                'expected_impact': impact_reduction,
                'confidence': round(attr['confidence']),
                'evidence': attr['evidence'],
                'nearby_sources': attr['nearby_sources'],
                'urgency': urgency,
                'estimated_inspection_time': inspection_time,
                'status': task_state['status'],
                'assigned_inspector': task_state['assigned_inspector'],
                'compliance_notes': task_state['compliance_notes'],
                'last_updated': task_state['last_updated']
            })
            
        # Sort recommendations by priority score descending
        recommendations.sort(key=lambda x: x['priority_score'], reverse=True)
        return recommendations

    def get_optimized_route(self, recommendations: list) -> list:
        """
        Groups critical/high priority locations and computes an optimized inspection route.
        Implements a nearest-neighbor spatial clustering algorithm to sequence the visits.
        """
        # Filter hotspots (Critical and High)
        hotspots = [r for r in recommendations if r['priority'] in ['Critical', 'High']]
        if not hotspots:
            return []
            
        # Sort using nearest-neighbor greedy TSP algorithm
        unvisited = list(hotspots)
        route = [unvisited.pop(0)] # Start with the highest priority hotspot
        
        while unvisited:
            curr = route[-1]
            # Find closest unvisited coordinate
            closest_idx = 0
            closest_dist = 999.0
            for idx, item in enumerate(unvisited):
                # Calculate distance in km
                dist = math.sqrt((curr['lat'] - item['lat'])**2 + (curr['lon'] - item['lon'])**2) * 111.0
                if dist < closest_dist:
                    closest_dist = dist
                    closest_idx = idx
            route.append(unvisited.pop(closest_idx))
            
        return route
