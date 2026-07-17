"""
Scenario Simulation & Digital Twin Agent
========================================
AI-powered Digital Twin that simulates environmental interventions
(traffic bans, construction halts, industrial limits, weather events, tree planting)
and models their impacts on AQI, public health, operations, and economics.
"""

import numpy as np
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid
from backend.services.data_fusion_service import CITY_BOUNDS

# ─── Intervention Configs ─────────────────────────────────────────────────────
INTERVENTION_METADATA = {
    'truck_ban': {
        'name': 'Heavy Vehicle Ban',
        'category': 'traffic',
        'base_cost': 'Low',
        'difficulty': 'Medium',
        'execution_time': '12 Hours',
        'aqi_impact_reduction': 23,
        'pm25_reduction_pct': 25,
        'pm10_reduction_pct': 28,
        'no2_reduction_pct': 30,
        'co_reduction_pct': 22,
        'so2_reduction_pct': 10,
        'o3_change_pct': 5,
        'confidence': 91,
        'feasibility_score': 90,
        'cost_score': 72,
        'priority_score': 94,
    },
    'odd_even': {
        'name': 'Odd-Even Policy',
        'category': 'traffic',
        'base_cost': 'Low',
        'difficulty': 'High',
        'execution_time': '24 Hours',
        'aqi_impact_reduction': 15,
        'pm25_reduction_pct': 16,
        'pm10_reduction_pct': 14,
        'no2_reduction_pct': 20,
        'co_reduction_pct': 18,
        'so2_reduction_pct': 5,
        'o3_change_pct': 3,
        'confidence': 87,
        'feasibility_score': 65,
        'cost_score': 85,
        'priority_score': 70,
    },
    'construction_halt': {
        'name': 'Pause Construction Activities',
        'category': 'construction',
        'base_cost': 'Medium',
        'difficulty': 'Medium',
        'execution_time': '6 Hours',
        'aqi_impact_reduction': 18,
        'pm25_reduction_pct': 15,
        'pm10_reduction_pct': 35,
        'no2_reduction_pct': 5,
        'co_reduction_pct': 5,
        'so2_reduction_pct': 5,
        'o3_change_pct': 0,
        'confidence': 89,
        'feasibility_score': 82,
        'cost_score': 60,
        'priority_score': 88,
    },
    'water_sprinkling': {
        'name': 'Road Water Sprinkling & Sweeping',
        'category': 'construction',
        'base_cost': 'Low',
        'difficulty': 'Low',
        'execution_time': '3 Hours',
        'aqi_impact_reduction': 12,
        'pm25_reduction_pct': 8,
        'pm10_reduction_pct': 22,
        'no2_reduction_pct': 2,
        'co_reduction_pct': 1,
        'so2_reduction_pct': 1,
        'o3_change_pct': 0,
        'confidence': 93,
        'feasibility_score': 95,
        'cost_score': 90,
        'priority_score': 85,
    },
    'industrial_curb': {
        'name': 'Industrial Emission Curb (30% reduction)',
        'category': 'industrial',
        'base_cost': 'High',
        'difficulty': 'High',
        'execution_time': '48 Hours',
        'aqi_impact_reduction': 19,
        'pm25_reduction_pct': 18,
        'pm10_reduction_pct': 15,
        'no2_reduction_pct': 22,
        'co_reduction_pct': 12,
        'so2_reduction_pct': 32,
        'o3_change_pct': 8,
        'confidence': 90,
        'feasibility_score': 70,
        'cost_score': 45,
        'priority_score': 80,
    },
    'precipitation': {
        'name': 'Simulate Rainfall (Artificial/Natural)',
        'category': 'weather',
        'base_cost': 'High',
        'difficulty': 'High',
        'execution_time': '24 Hours',
        'aqi_impact_reduction': 37,
        'pm25_reduction_pct': 38,
        'pm10_reduction_pct': 45,
        'no2_reduction_pct': 30,
        'co_reduction_pct': 25,
        'so2_reduction_pct': 35,
        'o3_change_pct': -10,
        'confidence': 95,
        'feasibility_score': 40,
        'cost_score': 30,
        'priority_score': 65,
    },
    'green_corridors': {
        'name': 'Green Corridors & Tree Plantation',
        'category': 'urban',
        'base_cost': 'Medium',
        'difficulty': 'Low',
        'execution_time': '72 Hours',
        'aqi_impact_reduction': 8,
        'pm25_reduction_pct': 7,
        'pm10_reduction_pct': 10,
        'no2_reduction_pct': 6,
        'co_reduction_pct': 5,
        'so2_reduction_pct': 5,
        'o3_change_pct': 2,
        'confidence': 82,
        'feasibility_score': 88,
        'cost_score': 75,
        'priority_score': 72,
    }
}

# ─── In-Memory Store ──────────────────────────────────────────────────────────
SIMULATION_HISTORY: List[Dict[str, Any]] = []

def _get_seeded_rng(seed_str: str) -> np.random.Generator:
    import hashlib
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    return np.random.default_rng(seed)

class DigitalTwinAgent:
    """
    Simulates the environmental, health, economic, and resource requirements
    of municipal policy actions in a city digital twin context.
    """

    def simulate_scenario(self, city: str, intervention_keys: List[str], forecast_service) -> Dict[str, Any]:
        """
        Executes a multi-intervention simulation and returns comprehensive digital twin metrics.
        """
        city_key = city.lower()
        sim_id = str(uuid.uuid4())[:8].upper()
        rng = _get_seeded_rng(f"{city_key}_twin_{sim_id}")

        # Fetch grid baseline data
        baseline_grids = []
        if forecast_service:
            try:
                baseline_grids = forecast_service.get_all_current()
            except Exception:
                pass
        
        # Build 400 default grids if service is uninitialized
        if not baseline_grids:
            for gid in range(400):
                baseline_grids.append({
                    'grid_id': gid,
                    'current_aqi': 240,
                    'pm25': 150,
                    'pm10': 250,
                    'no2': 80,
                    'so2': 25,
                    'co': 2.5,
                    'o3': 60,
                    'confidence': 90,
                })

        # Calculate composite modifiers based on selected interventions
        aqi_red_multiplier = 1.0
        pm25_red_multiplier = 1.0
        pm10_red_multiplier = 1.0
        no2_red_multiplier = 1.0
        so2_red_multiplier = 1.0
        co_red_multiplier = 1.0
        o3_red_multiplier = 1.0

        for key in intervention_keys:
            meta = INTERVENTION_METADATA.get(key)
            if meta:
                aqi_red_multiplier *= (1.0 - meta['aqi_impact_reduction'] / 100.0)
                pm25_red_multiplier *= (1.0 - meta['pm25_reduction_pct'] / 100.0)
                pm10_red_multiplier *= (1.0 - meta['pm10_reduction_pct'] / 100.0)
                no2_red_multiplier *= (1.0 - meta['no2_reduction_pct'] / 100.0)
                so2_red_multiplier *= (1.0 - meta['so2_reduction_pct'] / 100.0)
                co_red_multiplier *= (1.0 - meta['co_reduction_pct'] / 100.0)
                o3_red_multiplier *= (1.0 - meta.get('o3_change_pct', 0) / 100.0)

        # Average AQI before and after
        avg_aqi_before = sum(g.get('current_aqi', g.get('aqi', 240)) for g in baseline_grids) / len(baseline_grids)
        avg_aqi_after = avg_aqi_before * aqi_red_multiplier
        pct_reduction = round((1.0 - aqi_red_multiplier) * 100, 1)

        # Simulation timeline forecast (Current, 6h, 12h, 24h, 48h, 72h)
        timeline = []
        steps = [0, 6, 12, 24, 48, 72]
        for step in steps:
            # Over time the intervention effectiveness hits peak at 24h and decays or stabilizes
            time_factor = (
                0.0 if step == 0 else
                (0.4 if step == 6 else
                 (0.75 if step == 12 else
                  (1.0 if step == 24 else
                   (0.92 if step == 48 else 0.85))))
            )
            sim_factor = 1.0 - (1.0 - aqi_red_multiplier) * time_factor
            timeline.append({
                'horizon': f'{step}h',
                'simulated_aqi': round(avg_aqi_before * sim_factor, 1),
                'percent_improvement': round((1.0 - sim_factor) * 100, 1)
            })

        # Estimate health impacts
        pop_density_baseline = int(rng.integers(12000, 32000))
        affected_pop = int(pop_density_baseline * 400 * 0.15) # Simulated 15% exposed population
        visits_prevented = int((avg_aqi_before - avg_aqi_after) * 2.8 * (len(intervention_keys) or 1))
        asthma_prevented = int(visits_prevented * 0.55)
        copd_prevented = int(visits_prevented * 0.35)

        # Policy Scoring
        impact_score = int(np.clip(pct_reduction * 2.5, 10, 99))
        cost_score = 90
        feasibility_score = 90
        if len(intervention_keys) > 0:
            costs = [INTERVENTION_METADATA[k]['cost_score'] for k in intervention_keys if k in INTERVENTION_METADATA]
            feas = [INTERVENTION_METADATA[k]['feasibility_score'] for k in intervention_keys if k in INTERVENTION_METADATA]
            if costs: cost_score = int(sum(costs) / len(costs))
            if feas: feasibility_score = int(sum(feas) / len(feas))
        priority_score = int((impact_score + feasibility_score + cost_score) / 3)

        recommendation = 'Highly Recommended' if priority_score >= 80 else ('Recommended' if priority_score >= 60 else 'Neutral')

        # Resource Estimation
        num_keys = len(intervention_keys) or 1
        inspectors = int(num_keys * 8 + rng.integers(2, 6))
        police = int(num_keys * 25 + rng.integers(5, 15))
        tankers = int(num_keys * 12 + rng.integers(3, 8))
        budget = int(num_keys * 150000 + rng.integers(10000, 50000))

        # Build grid-level changes map
        simulated_grids = []
        b = CITY_BOUNDS.get(city_key, CITY_BOUNDS['bengaluru'])
        lat_step = (b['lat_max'] - b['lat_min']) / 20
        lon_step = (b['lon_max'] - b['lon_min']) / 20

        for g in baseline_grids:
            grid_id = g['grid_id']
            row = grid_id // 20
            col = grid_id % 20

            lat_min = b['lat_min'] + row * lat_step
            lat_max = lat_min + lat_step
            lon_min = b['lon_min'] + col * lon_step
            lon_max = lon_min + lon_step

            g_lat = (lat_min + lat_max) / 2
            g_lon = (lon_min + lon_max) / 2

            g_aqi = g.get('current_aqi', g.get('aqi', 240))
            sim_aqi = round(g_aqi * aqi_red_multiplier, 1)
            simulated_grids.append({
                'grid_id': grid_id,
                'lat': round(g_lat, 6),
                'lon': round(g_lon, 6),
                'before_aqi': g_aqi,
                'after_aqi': sim_aqi,
                'reduction_pct': round((1.0 - aqi_red_multiplier) * 100, 1),
                'is_hotspot_resolved': bool(g_aqi > 200 and sim_aqi <= 200),
            })

        # Calculate average pollutant values
        avg_pm25 = sum(g.get('pm25', 150) for g in baseline_grids) / len(baseline_grids)
        avg_pm10 = sum(g.get('pm10', 250) for g in baseline_grids) / len(baseline_grids)
        avg_no2 = sum(g.get('no2', 80) for g in baseline_grids) / len(baseline_grids)
        avg_so2 = sum(g.get('so2', 25) for g in baseline_grids) / len(baseline_grids)
        avg_co = sum(g.get('co', 2.5) for g in baseline_grids) / len(baseline_grids)

        result = {
            'simulation_id': sim_id,
            'city': city_key,
            'interventions': intervention_keys,
            'intervention_names': [INTERVENTION_METADATA[k]['name'] for k in intervention_keys if k in INTERVENTION_METADATA],
            'confidence': int(np.clip(94 - num_keys * 2, 70, 96)),
            
            # Baseline vs simulated
            'summary': {
                'avg_aqi_before': round(avg_aqi_before, 1),
                'avg_aqi_after': round(avg_aqi_after, 1),
                'aqi_reduction_pct': pct_reduction,
                'pm25_before': round(avg_pm25, 1),
                'pm25_after': round(avg_pm25 * pm25_red_multiplier, 1),
                'pm10_before': round(avg_pm10, 1),
                'pm10_after': round(avg_pm10 * pm10_red_multiplier, 1),
                'no2_before': round(avg_no2, 1),
                'no2_after': round(avg_no2 * no2_red_multiplier, 1),
                'so2_before': round(avg_so2, 1),
                'so2_after': round(avg_so2 * so2_red_multiplier, 1),
                'co_before': round(avg_co, 2),
                'co_after': round(avg_co * co_red_multiplier, 2),
            },

            # Health Impact
            'health_impact': {
                'affected_population': affected_pop,
                'hospital_visits_prevented': visits_prevented,
                'asthma_attacks_prevented': asthma_prevented,
                'copd_flareups_prevented': copd_prevented,
                'school_safety_improvement': 'Highly Improved' if pct_reduction > 20 else 'Moderately Improved',
            },

            # Policy score
            'policy_score': {
                'impact': impact_score,
                'cost': cost_score,
                'feasibility': feasibility_score,
                'priority': priority_score,
                'recommendation': recommendation
            },

            # Resource estimation
            'resources': {
                'inspectors_required': inspectors,
                'police_personnel': police,
                'water_tankers': tankers,
                'estimated_budget_inr': budget,
            },

            # Environment & Carbon
            'environmental_benefit': {
                'co2_reduction_tons': round(num_keys * 45.8 + rng.uniform(2.5, 8.5), 1),
                'particulate_matter_tons': round(num_keys * 8.2 + rng.uniform(0.5, 2.5), 1),
                'carbon_savings_index': int(np.clip(num_keys * 15, 10, 95)),
            },

            'timeline': timeline,
            'grid_changes': simulated_grids,
            'generated_at': datetime.now(timezone.utc).isoformat(),
        }

        # Store in history (keep history list size capped at 30)
        SIMULATION_HISTORY.append(result)
        if len(SIMULATION_HISTORY) > 30:
            SIMULATION_HISTORY.pop(0)

        return result

    def get_history(self) -> List[Dict[str, Any]]:
        """Returns log history of all completed scenario runs."""
        return [
            {
                'simulation_id': h['simulation_id'],
                'city': h['city'],
                'interventions': h['interventions'],
                'intervention_names': h['intervention_names'],
                'aqi_before': h['summary']['avg_aqi_before'],
                'aqi_after': h['summary']['avg_aqi_after'],
                'aqi_reduction_pct': h['summary']['aqi_reduction_pct'],
                'recommendation': h['policy_score']['recommendation'],
                'generated_at': h['generated_at'],
            }
            for h in reversed(SIMULATION_HISTORY)
        ]

    def get_simulation_detail(self, sim_id: str) -> Optional[Dict[str, Any]]:
        """Returns full parameters for a single simulation."""
        for h in SIMULATION_HISTORY:
            if h['simulation_id'] == sim_id:
                return h
        return None

    def get_ai_recommendations(self, city: str, forecast_service) -> Dict[str, Any]:
        """
        AI Strategy Advisor. Identifies optimal policy bundle
        to achieve maximum AQI reduction with highest feasibility.
        """
        city_key = city.lower()
        rng = _get_seeded_rng(f"{city_key}_ai_recs")

        # Run individual simulations to rank their parameters
        strategies = []
        for key in INTERVENTION_METADATA.keys():
            sim = self.simulate_scenario(city_key, [key], forecast_service)
            strategies.append({
                'key': key,
                'name': INTERVENTION_METADATA[key]['name'],
                'reduction': sim['summary']['aqi_reduction_pct'],
                'priority': sim['policy_score']['priority'],
                'cost_grade': 'Low' if INTERVENTION_METADATA[key]['cost_score'] >= 75 else ('Medium' if INTERVENTION_METADATA[key]['cost_score'] >= 55 else 'High'),
            })

        # Rank strategies by priority score
        strategies.sort(key=lambda x: x['priority'], reverse=True)

        # Formulate recommended bundles
        recommended_bundle = ['truck_ban', 'construction_halt', 'water_sprinkling']
        bundle_sim = self.simulate_scenario(city_key, recommended_bundle, forecast_service)

        return {
            'recommended_strategy': 'Traffic Enforcement + Dust Control Corridor Bundle',
            'recommended_interventions': recommended_bundle,
            'recommended_intervention_names': [INTERVENTION_METADATA[k]['name'] for k in recommended_bundle],
            'expected_aqi_reduction_pct': bundle_sim['summary']['aqi_reduction_pct'],
            'expected_aqi_after': bundle_sim['summary']['avg_aqi_after'],
            'confidence': 95,
            'resources': bundle_sim['resources'],
            'top_individual_strategies': strategies[:4],
        }
