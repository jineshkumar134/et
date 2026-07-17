import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import {
  Search, Layers, Clock, Zap, MapPin, Users, Building2,
  Radio, CheckCircle, AlertCircle, Wind
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
interface CityOption {
  id: string;
  name: string;
  state: string;
  lat_center: number;
  lon_center: number;
  population: string;
  area_km2: number;
  monitoring_stations: number;
}

interface DataSource {
  id: string;
  name: string;
  description: string;
  status: string;
  last_updated: string;
}

interface ConfigOptions {
  cities: CityOption[];
  resolutions: { id: string; name: string; description: string }[];
  sources: DataSource[];
}

/* ── Large Indian city list for unrestricted search ──────── */
const INDIA_CITIES: { name: string; state: string }[] = [
  { name: 'Agartala',       state: 'Tripura'          },
  { name: 'Agra',           state: 'Uttar Pradesh'    },
  { name: 'Ahmedabad',      state: 'Gujarat'          },
  { name: 'Aizawl',         state: 'Mizoram'          },
  { name: 'Ajmer',          state: 'Rajasthan'        },
  { name: 'Aligarh',        state: 'Uttar Pradesh'    },
  { name: 'Alipurduar',     state: 'West Bengal'      },
  { name: 'Alirajpur',      state: 'Madhya Pradesh'   },
  { name: 'Allahabad',      state: 'Uttar Pradesh'    },
  { name: 'Amravati',       state: 'Maharashtra'      },
  { name: 'Amritsar',       state: 'Punjab'           },
  { name: 'Anantapur',      state: 'Andhra Pradesh'   },
  { name: 'Asansol',        state: 'West Bengal'      },
  { name: 'Aurangabad',     state: 'Maharashtra'      },
  { name: 'Bareilly',       state: 'Uttar Pradesh'    },
  { name: 'Belgaum',        state: 'Karnataka'        },
  { name: 'Bengaluru',      state: 'Karnataka'        },
  { name: 'Bhopal',         state: 'Madhya Pradesh'   },
  { name: 'Bhubaneswar',    state: 'Odisha'           },
  { name: 'Bikaner',        state: 'Rajasthan'        },
  { name: 'Chandigarh',     state: 'Chandigarh UT'   },
  { name: 'Chennai',        state: 'Tamil Nadu'       },
  { name: 'Coimbatore',     state: 'Tamil Nadu'       },
  { name: 'Cuttack',        state: 'Odisha'           },
  { name: 'Dahanu',         state: 'Maharashtra'      },
  { name: 'Dehradun',       state: 'Uttarakhand'      },
  { name: 'Delhi',          state: 'Delhi NCT'        },
  { name: 'Dhanbad',        state: 'Jharkhand'        },
  { name: 'Durg',           state: 'Chhattisgarh'     },
  { name: 'Faridabad',      state: 'Haryana'          },
  { name: 'Ghaziabad',      state: 'Uttar Pradesh'    },
  { name: 'Gorakhpur',      state: 'Uttar Pradesh'    },
  { name: 'Gulbarga',       state: 'Karnataka'        },
  { name: 'Gurgaon',        state: 'Haryana'          },
  { name: 'Guwahati',       state: 'Assam'            },
  { name: 'Gwalior',        state: 'Madhya Pradesh'   },
  { name: 'Hubli-Dharwad',  state: 'Karnataka'        },
  { name: 'Hyderabad',      state: 'Telangana'        },
  { name: 'Imphal',         state: 'Manipur'          },
  { name: 'Indore',         state: 'Madhya Pradesh'   },
  { name: 'Itanagar',       state: 'Arunachal Pradesh'},
  { name: 'Jabalpur',       state: 'Madhya Pradesh'   },
  { name: 'Jaipur',         state: 'Rajasthan'        },
  { name: 'Jalandhar',      state: 'Punjab'           },
  { name: 'Jammu',          state: 'J&K'              },
  { name: 'Jamshedpur',     state: 'Jharkhand'        },
  { name: 'Jodhpur',        state: 'Rajasthan'        },
  { name: 'Kakinada',       state: 'Andhra Pradesh'   },
  { name: 'Kanpur',         state: 'Uttar Pradesh'    },
  { name: 'Kochi',          state: 'Kerala'           },
  { name: 'Kohima',         state: 'Nagaland'         },
  { name: 'Kolkata',        state: 'West Bengal'      },
  { name: 'Kozhikode',      state: 'Kerala'           },
  { name: 'Lucknow',        state: 'Uttar Pradesh'    },
  { name: 'Ludhiana',       state: 'Punjab'           },
  { name: 'Madurai',        state: 'Tamil Nadu'       },
  { name: 'Mangaluru',      state: 'Karnataka'        },
  { name: 'Meerut',         state: 'Uttar Pradesh'    },
  { name: 'Mumbai',         state: 'Maharashtra'      },
  { name: 'Mysuru',         state: 'Karnataka'        },
  { name: 'Nagpur',         state: 'Maharashtra'      },
  { name: 'Nashik',         state: 'Maharashtra'      },
  { name: 'Navi Mumbai',    state: 'Maharashtra'      },
  { name: 'Noida',          state: 'Uttar Pradesh'    },
  { name: 'Panaji',         state: 'Goa'              },
  { name: 'Patna',          state: 'Bihar'            },
  { name: 'Pimpri-Chinchwad', state: 'Maharashtra'   },
  { name: 'Port Blair',     state: 'A&N Islands'      },
  { name: 'Pune',           state: 'Maharashtra'      },
  { name: 'Raipur',         state: 'Chhattisgarh'     },
  { name: 'Rajkot',         state: 'Gujarat'          },
  { name: 'Ranchi',         state: 'Jharkhand'        },
  { name: 'Salem',          state: 'Tamil Nadu'       },
  { name: 'Shillong',       state: 'Meghalaya'        },
  { name: 'Shimla',         state: 'Himachal Pradesh' },
  { name: 'Siliguri',       state: 'West Bengal'      },
  { name: 'Srinagar',       state: 'J&K'              },
  { name: 'Surat',          state: 'Gujarat'          },
  { name: 'Thane',          state: 'Maharashtra'      },
  { name: 'Thiruvananthapuram', state: 'Kerala'       },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu'      },
  { name: 'Tirunelveli',    state: 'Tamil Nadu'       },
  { name: 'Udaipur',        state: 'Rajasthan'        },
  { name: 'Vadodara',       state: 'Gujarat'          },
  { name: 'Varanasi',       state: 'Uttar Pradesh'    },
  { name: 'Vijayawada',     state: 'Andhra Pradesh'   },
  { name: 'Visakhapatnam',  state: 'Andhra Pradesh'   },
  { name: 'Warangal',       state: 'Telangana'        },
];

/* Map simulated city IDs to the closest backend-supported city */
const NEAREST_BACKEND_CITY: Record<string, string> = {
  // Karnataka cities → bengaluru
  mysuru: 'bengaluru', mangaluru: 'bengaluru', hublidharwad: 'bengaluru',
  belgaum: 'bengaluru', gulbarga: 'bengaluru',
  // UP / Delhi region → delhi
  noida: 'delhi', ghaziabad: 'delhi', faridabad: 'delhi',
  gurgaon: 'delhi', meerut: 'delhi', agra: 'delhi', aligarh: 'delhi',
  lucknow: 'delhi', kanpur: 'delhi', bareilly: 'delhi', gorakhpur: 'delhi',
  allahabad: 'delhi', varanasi: 'delhi',
  // Maharashtra cities → mumbai
  nashik: 'mumbai', nagpur: 'mumbai', aurangabad: 'mumbai',
  thane: 'mumbai', naviMumbai: 'mumbai', pimprichinchwad: 'pune',
  solapur: 'pune', kolhapur: 'pune', amravati: 'mumbai', dahanu: 'mumbai',
  // Tamil Nadu → chennai
  coimbatore: 'chennai', madurai: 'chennai', tiruchirappalli: 'chennai',
  tirunelveli: 'chennai', salem: 'chennai',
  // WB / East → kolkata
  asansol: 'kolkata', siliguri: 'kolkata', durg: 'kolkata', dhanbad: 'kolkata',
  // Telangana → hyderabad
  warangal: 'hyderabad',
  // Gujarat → ahmedabad
  surat: 'ahmedabad', vadodara: 'ahmedabad', rajkot: 'ahmedabad',
  // Rajasthan → ahmedabad / delhi
  jaipur: 'delhi', jodhpur: 'ahmedabad', udaipur: 'ahmedabad',
  ajmer: 'ahmedabad', bikaner: 'ahmedabad',
  // Punjab / Haryana → delhi
  chandigarh: 'delhi', ludhiana: 'delhi', jalandhar: 'delhi', amritsar: 'delhi',
};

function resolveBackendCity(cityName: string, backendCities: CityOption[]): string {
  const key = cityName.toLowerCase().replace(/[^a-z]/g, '');
  // Check exact match first
  const exact = backendCities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  if (exact) return exact.id;
  // Check lookup map
  if (NEAREST_BACKEND_CITY[key]) return NEAREST_BACKEND_CITY[key];
  // Default to bengaluru
  return 'bengaluru';
}

/* ── Processing steps ──────────────────────────────────────── */
const PROCESSING_STEPS = [
  'Loading CAAQMS Data',
  'Downloading Weather',
  'Processing Satellite Images',
  'Generating Spatial Grid',
  'Running Forecast Model',
  'Computing Confidence Scores',
  'Generating Heatmaps',
  'Preparing Dashboard',
];

/* ── Component ─────────────────────────────────────────────── */
export const Onboarding: React.FC = () => {
  const { config, updateConfig } = useConfig();
  const navigate = useNavigate();

  /* Backend options */
  const [options, setOptions]     = useState<ConfigOptions | null>(null);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  /* City search */
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{ name: string; state: string; backendId: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  /* Form */
  const [resolution, setResolution]   = useState('1km');
  const [horizon, setHorizon]         = useState<'current'|'24h'|'48h'|'72h'>('24h');

  /* Selected city backend metadata */
  const [cityMeta, setCityMeta] = useState<CityOption | null>(null);

  /* AI Processing */
  const [processing, setProcessing]       = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingDone, setProcessingDone] = useState(false);

  /* ── Load options from backend ── */
  useEffect(() => {
    axios.get('http://localhost:8000/api/config/options')
      .then(res => {
        setOptions(res.data);
        // Pre-fill from saved config
        if (config) {
          const bc = res.data.cities.find((c: CityOption) => c.id === config.city);
          if (bc) {
            setSelectedCity({ name: bc.name, state: bc.state, backendId: bc.id });
            setSearchQuery(bc.name);
            setCityMeta(bc);
          }
          setResolution(config.resolution);
          setHorizon(config.horizon);
        } else {
          // Default to Bengaluru
          const def = res.data.cities.find((c: CityOption) => c.id === 'bengaluru');
          if (def) {
            setSelectedCity({ name: def.name, state: def.state, backendId: def.id });
            setSearchQuery(def.name);
            setCityMeta(def);
          }
        }
      })
      .catch(() => setApiError('Unable to connect to backend. Please ensure the server is running.'))
      .finally(() => setInitLoading(false));
  }, []);

  /* ── Click outside dropdown ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── City search filtering ── */
  const filteredCities = useCallback(() => {
    if (!searchQuery.trim()) return INDIA_CITIES.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return INDIA_CITIES.filter(c => c.name.toLowerCase().startsWith(q))
      .concat(INDIA_CITIES.filter(c =>
        c.name.toLowerCase().includes(q) && !c.name.toLowerCase().startsWith(q)
      ))
      .slice(0, 12);
  }, [searchQuery]);

  const handleCitySelect = (city: { name: string; state: string }) => {
    const backendId = resolveBackendCity(city.name, options?.cities ?? []);
    setSelectedCity({ ...city, backendId });
    setSearchQuery(city.name);
    setShowDropdown(false);
    // Set city meta
    const meta = options?.cities.find(c => c.id === backendId) ?? null;
    setCityMeta(meta);
  };

  /* ── AI Processing simulation ── */
  const runProcessing = useCallback(async (backendCityId: string) => {
    setProcessing(true);
    setProcessingStep(0);

    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingStep(i);
      await new Promise(r => setTimeout(r, 420));
    }

    setProcessingDone(true);
    await updateConfig({ city: backendCityId, resolution, horizon });
    await new Promise(r => setTimeout(r, 600));
    navigate('/');
  }, [resolution, horizon, updateConfig, navigate]);

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCity) { alert('Please select a city.'); return; }
    runProcessing(selectedCity.backendId);
  };

  /* ── Loading / error states ── */
  if (initLoading) {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
          <p className="text-[13px] text-[#9CA3AF]">Connecting to backend services…</p>
        </div>
      </Screen>
    );
  }

  if (apiError) {
    return (
      <Screen>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto" strokeWidth={1.5} />
          <h2 className="text-[15px] font-600 text-[#F9FAFB]">Backend Unavailable</h2>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{apiError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-600 rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </Screen>
    );
  }

  /* ── AI Processing Overlay ── */
  if (processing) {
    return (
      <Screen>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-10 w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin mx-auto mb-4" />
            <h2 className="text-[16px] font-600 text-[#F9FAFB]">Generating Spatial Forecast</h2>
            <p className="text-[12px] text-[#6B7280] mt-1">
              {selectedCity?.name}, {selectedCity?.state}
            </p>
          </div>

          <div className="space-y-2.5">
            {PROCESSING_STEPS.map((step, idx) => {
              const done    = processingDone || idx < processingStep;
              const active  = !processingDone && idx === processingStep;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-[#16A34A]" strokeWidth={2} />
                    ) : active ? (
                      <div className="w-3 h-3 rounded-full bg-[#2563EB] step-pulse" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-[#374151]" />
                    )}
                  </div>
                  <span className={`text-[13px] ${done ? 'text-[#9CA3AF]' : active ? 'text-[#F9FAFB] font-500' : 'text-[#4B5563]'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Overall progress bar */}
          <div className="h-1 bg-[#374151] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
              style={{ width: `${((processingStep + 1) / PROCESSING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </Screen>
    );
  }

  /* ── Main Onboarding UI ── */
  const sources = options?.sources ?? [];
  const resolutions = options?.resolutions ?? [];

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Minimal top bar */}
      <header className="h-[52px] bg-[#1F2937] border-b border-[#374151] flex items-center px-6 gap-2.5">
        <div className="w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center">
          <Wind className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-600 text-[#F9FAFB]">Urban Air Quality Intelligence Platform</span>
        <span className="text-[11px] text-[#4B5563] ml-1">· Decision Support System</span>
      </header>

      {/* Main two-column layout */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

          {/* ── LEFT COLUMN: Configuration ── */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
            <div className="px-8 py-5 border-b border-[#374151]">
              <h1 className="text-[18px] font-700 text-[#F9FAFB]">Configure Forecast</h1>
              <p className="text-[13px] text-[#6B7280] mt-0.5">
                Select a city and parameters to generate a hyperlocal AQI forecast.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-7">

              {/* City Search */}
              <div className="space-y-2" ref={searchRef}>
                <label className="flex items-center gap-2 text-[12px] font-600 text-[#9CA3AF] uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Indian City
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
                  <input
                    type="text"
                    placeholder="Type any Indian city…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#111827] border border-[#374151] focus:border-[#2563EB] rounded-lg text-[13px] text-[#F9FAFB] placeholder-[#4B5563] focus:outline-none transition-colors"
                  />
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1F2937] border border-[#374151] rounded-lg shadow-xl overflow-hidden">
                      {filteredCities().map((c, i) => {
                        const isBackend = options?.cities.some(bc => bc.name === c.name);
                        return (
                          <div
                            key={i}
                            onClick={() => handleCitySelect(c)}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-[#374151]/50 cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="text-[13px] text-[#F9FAFB] font-500">{c.name}</p>
                              <p className="text-[11px] text-[#6B7280]">{c.state}</p>
                            </div>
                            {isBackend && (
                              <span className="text-[10px] text-[#2563EB] bg-[#2563EB]/10 border border-[#2563EB]/20 px-2 py-0.5 rounded font-600 uppercase">
                                Full Data
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {filteredCities().length === 0 && searchQuery && (
                        <div className="px-4 py-3 text-[12px] text-[#6B7280] italic">
                          No cities match "{searchQuery}". Try a different spelling.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedCity && (
                  <p className="text-[11px] text-[#6B7280]">
                    Selected: <span className="text-[#9CA3AF] font-500">{selectedCity.name}, {selectedCity.state}</span>
                    {selectedCity.backendId !== selectedCity.name.toLowerCase() && (
                      <span className="ml-1 text-[#F59E0B]">· Using {options?.cities.find(c=>c.id===selectedCity.backendId)?.name} data</span>
                    )}
                  </p>
                )}
              </div>

              {/* Grid Resolution */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[12px] font-600 text-[#9CA3AF] uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Grid Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {resolutions.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={`px-3 py-3 rounded-lg border text-left transition-colors ${
                        resolution === r.id
                          ? 'bg-[#2563EB]/10 border-[#2563EB] text-[#93C5FD]'
                          : 'bg-[#111827] border-[#374151] text-[#9CA3AF] hover:border-[#4B5563]'
                      }`}
                    >
                      <p className="text-[13px] font-600">{r.name}</p>
                      <p className="text-[11px] mt-0.5 opacity-70">{r.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Forecast Horizon */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[12px] font-600 text-[#9CA3AF] uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Forecast Horizon
                </label>
                <div className="flex bg-[#111827] border border-[#374151] rounded-lg p-1 gap-1">
                  {(['current','24h','48h','72h'] as const).map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorizon(h)}
                      className={`flex-1 py-2 rounded-md text-[12px] font-600 transition-colors ${
                        horizon === h
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'text-[#6B7280] hover:text-[#9CA3AF]'
                      }`}
                    >
                      {h === 'current' ? 'Current' : h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!selectedCity}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-600 rounded-lg transition-colors shadow-sm"
              >
                <Zap className="w-4 h-4" strokeWidth={2} />
                Generate Spatial Forecast
              </button>
            </form>
          </div>

          {/* ── RIGHT COLUMN: City Info ── */}
          <div className="space-y-4">

            {/* City Details Card */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#374151]">
                <h2 className="text-[13px] font-600 text-[#F9FAFB]">City Information</h2>
              </div>
              {cityMeta ? (
                <div className="p-5 space-y-4">
                  {/* City name */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#2563EB]" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[15px] font-700 text-[#F9FAFB]">{cityMeta.name}</p>
                      <p className="text-[12px] text-[#6B7280]">{cityMeta.state}</p>
                      <p className="text-[11px] text-[#4B5563] mt-0.5 font-mono">
                        {cityMeta.lat_center.toFixed(4)}°N, {cityMeta.lon_center.toFixed(4)}°E
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Population" value={cityMeta.population} />
                    <StatTile icon={<Building2 className="w-3.5 h-3.5" />} label="Area (km²)" value={cityMeta.area_km2.toLocaleString()} />
                    <StatTile icon={<Radio className="w-3.5 h-3.5" />} label="Stations" value={String(cityMeta.monitoring_stations)} />
                  </div>
                </div>
              ) : (
                <div className="p-5 text-[13px] text-[#6B7280] text-center py-8">
                  Search and select a city to view details.
                </div>
              )}
            </div>

            {/* Data Sources */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#374151]">
                <h2 className="text-[13px] font-600 text-[#F9FAFB]">Connected Data Sources</h2>
              </div>
              <div className="p-3 space-y-2">
                {sources.map(src => (
                  <div key={src.id} className="flex items-center justify-between px-3 py-2.5 bg-[#111827] rounded-lg border border-[#374151]">
                    <div>
                      <p className="text-[12px] font-600 text-[#F9FAFB]">{src.name}</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Updated {src.last_updated}</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded text-[10px] font-600 text-[#16A34A] uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                      Active
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Helper sub-components ── */
const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#111827] flex items-center justify-center">
    {children}
  </div>
);

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-[#111827] border border-[#374151] rounded-lg p-2.5 text-center">
    <div className="flex items-center justify-center text-[#6B7280] mb-1">{icon}</div>
    <p className="text-[13px] font-700 text-[#F9FAFB]">{value}</p>
    <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">{label}</p>
  </div>
);

export default Onboarding;
