import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { postRoutes, getReports, confirmReport } from '@/lib/api';
import { RouteResponse, ReportOut, LatLon } from '@/lib/types';
import { MapView } from '@/components/map-view';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { PROFILE_PRESETS, SEVERITY_COLOR, SEVERITY_LABEL, HAZARD_TYPE_LABEL } from '@/lib/profiles';
import { Navigation, Target, Clock, Activity, AlertTriangle, Check, X, Sparkles } from 'lucide-react';

export default function MapScreen() {
  const { config, profile, setProfile, customProfileId, start, setStart, startName, setStartName, end, setEnd, endName, setEndName, reportsVersion, refreshReports } = useAppStore();
  const [pickMode, setPickMode] = useState<'start' | 'end' | null>(null);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportOut[]>([]);
  const [activeHazardId, setActiveHazardId] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<LatLon | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReports().then(res => { if(!cancelled) setReports(res); });
    return () => { cancelled = true; };
  }, [reportsVersion]);

  useEffect(() => {
    if (!start || !end || (profile === 'custom' && !customProfileId)) return;
    let cancelled = false;
    setLoading(true);
    postRoutes({
      start_lat: start.lat, start_lon: start.lon,
      end_lat: end.lat, end_lon: end.lon,
      profile, custom_profile_id: customProfileId
    }).then(res => {
      if(!cancelled) {
        setRouteData(res);
        getReports().then(nextReports => {
          if (!cancelled) setReports(nextReports);
        });
      }
    }).finally(() => {
      if(!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [start, end, profile, customProfileId, reportsVersion]);

  const activeHazard = reports.find(r => r.id === activeHazardId);

  if (!config) return <div className="flex h-full items-center justify-center font-bold text-muted-foreground">Initializing engine...</div>;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background overflow-hidden">
      
      {/* Map (Top on Mobile, Right on Desktop) */}
      <div className="h-[28vh] min-h-[175px] md:min-h-[auto] md:h-full md:flex-1 relative order-1 md:order-2 bg-muted/20 shrink-0 z-0 transition-all duration-300">
        <MapView 
          bbox={config.bbox} start={start} end={end} routeData={routeData} reports={reports}
          focusLocation={focusLocation}
          pickMode={pickMode} 
          onMapClick={(p) => {
            setRouteData(null);
            setFocusLocation(p);
            if (pickMode === 'start') { setStart(p); setStartName("Map Location"); setPickMode(null); }
            else if (pickMode === 'end') { setEnd(p); setEndName("Map Location"); setPickMode(null); }
          }}
          activeHazardId={activeHazardId}
          onHazardClick={setActiveHazardId}
        />
      </div>

      {/* Panel / Sheet (Bottom on Mobile, Left on Desktop) */}
      <div className="flex-1 min-h-0 md:w-96 lg:w-[480px] shrink-0 bg-card md:border-r flex flex-col z-10 shadow-[0_-12px_40px_-10px_rgba(0,0,0,0.15)] md:shadow-2xl overflow-hidden order-2 md:order-1 relative rounded-t-[2rem] md:rounded-none -mt-6 md:mt-0">
        
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0 bg-card">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Profile Selector */}
        <div className="p-3 md:p-4 border-b shrink-0 bg-card md:bg-muted/10">
          <div className="flex overflow-x-auto gap-2 pb-2 px-2 pr-6 md:px-0 no-scrollbar items-center snap-x">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mx-1 shrink-0">Profile</span>
            {PROFILE_PRESETS.map(p => {
              const Icon = p.icon;
              const active = profile === p.name;
              return (
                <button 
                  key={p.name}
                  onClick={() => setProfile(p.name)}
                  className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full whitespace-nowrap text-sm font-bold border-2 transition-all snap-start ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:bg-muted'}`}
                >
                  <Icon size={18} /> {p.label}
                </button>
              );
            })}
            {profile === "custom" && (
               <div className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-sm font-bold border-2 border-primary bg-primary text-primary-foreground snap-start">
                 <Sparkles size={16} /> Custom
               </div>
            )}
          </div>
        </div>

        {/* Address Fields */}
        <div className="p-4 md:p-5 space-y-3 shrink-0 border-b relative z-20 bg-card shadow-sm">
          <AddressAutocomplete 
            label="start" placeholder="Where are you starting?" value={startName} 
            onSelect={(p, n) => {
              setRouteData(null);
              setFocusLocation(p);
              setStart(p);
              setStartName(n);
              setPickMode(null);
            }}
            active={pickMode === 'start'} onToggleActive={() => setPickMode(p => p === 'start' ? null : 'start')}
            icon={<Target size={20} className="text-green-600" />}
          />
          <AddressAutocomplete 
            label="destination" placeholder="Where do you want to go?" value={endName} 
            onSelect={(p, n) => {
              setRouteData(null);
              setFocusLocation(p);
              setEnd(p);
              setEndName(n);
              setPickMode(null);
            }}
            active={pickMode === 'end'} onToggleActive={() => setPickMode(p => p === 'end' ? null : 'end')}
            icon={<Navigation size={20} className="text-destructive" />}
          />
        </div>

        {/* Results Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-5 bg-muted/10 relative z-10 pb-12">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-in fade-in">
               <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"/>
               <span className="font-bold">Computing safest accessible route...</span>
            </div>
          )}
          
          {!loading && routeData && (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
               
               {/* Stepwise Route Card */}
               <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <h3 className="text-lg font-extrabold text-primary flex items-center gap-2"><Navigation size={20} /> Stepwise Route</h3>
                   <span className="text-sm font-bold bg-background px-3 py-1 rounded-full shadow-sm text-foreground">
                     {(routeData.stepwise.distance_m / 1000).toFixed(1)} km
                   </span>
                 </div>
                 
                 <div className="flex items-center gap-6 text-sm mb-4 font-medium relative z-10">
                   <div className="flex items-center gap-2 text-foreground"><Clock size={16} className="text-primary"/> {Math.round(routeData.stepwise.time_s / 60)} min</div>
                   <div className="flex items-center gap-2 text-foreground"><Activity size={16} className={routeData.stepwise.hazards_nearby.length ? 'text-destructive' : 'text-green-600'}/> {routeData.stepwise.hazards_nearby.length} hazards</div>
                 </div>
                 
                 {!routeData.stepwise.is_fully_accessible && (
                   <div className="text-xs bg-destructive/10 text-destructive p-3 rounded-xl mb-4 font-bold flex items-start gap-2 relative z-10 border border-destructive/20">
                     <AlertTriangle size={16} className="shrink-0" />
                     <span>No fully accessible path found. This route contains segments that may exceed your profile limits.</span>
                   </div>
                 )}
                 
                 <div className="text-sm font-medium text-foreground/80 leading-relaxed bg-background/60 p-4 rounded-xl border border-primary/10 relative z-10 shadow-sm">
                   {routeData.explanation}
                 </div>
               </div>

               {/* Shortest Route Card */}
               <div className="rounded-2xl border-2 border-border bg-card p-5 opacity-80 hover:opacity-100 transition-opacity">
                 <div className="flex items-center justify-between mb-2">
                   <h3 className="font-bold text-muted-foreground flex items-center gap-2">Shortest Path</h3>
                   <span className="text-sm font-bold">{(routeData.shortest.distance_m / 1000).toFixed(1)} km</span>
                 </div>
                 <div className="flex items-center gap-6 text-sm font-medium">
                   <div className="flex items-center gap-2 text-muted-foreground"><Clock size={16} /> {Math.round(routeData.shortest.time_s / 60)} min</div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity size={16} />
                      {routeData.shortest.hazards_nearby.length} {routeData.shortest.hazards_nearby.length === 1 ? 'hazard' : 'hazards'}
                    </div>
                 </div>
                  {routeData.shortest.hazards_nearby.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hazards on this route</p>
                      {routeData.shortest.hazards_nearby.map((id) => {
                        const hazard = reports.find((report) => report.id === id);
                        if (!hazard) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setActiveHazardId(id)}
                            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                              style={{ background: SEVERITY_COLOR[hazard.severity] }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-foreground">
                                {HAZARD_TYPE_LABEL[hazard.hazard_type] || hazard.hazard_type}
                              </span>
                              <span className="block truncate text-xs font-medium text-muted-foreground">
                                {SEVERITY_LABEL[hazard.severity] || `Severity ${hazard.severity}`} · Tap to view details
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
               </div>
             </div>
          )}

          {/* Floating Hazard details */}
          {activeHazard && (
             <div className="mt-6 p-5 bg-card rounded-2xl border-2 shadow-xl relative overflow-hidden animate-in slide-in-from-bottom-4">
               <button onClick={() => setActiveHazardId(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground bg-muted p-1 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"><X size={18}/></button>
               <div className="font-extrabold text-lg mb-2 flex items-center gap-3 pr-8">
                 <span className="w-4 h-4 rounded-full shadow-inner shrink-0" style={{ background: SEVERITY_COLOR[activeHazard.severity] }} />
                 <span className="truncate">{HAZARD_TYPE_LABEL[activeHazard.hazard_type] || activeHazard.hazard_type}</span>
               </div>
               <p className="text-sm font-medium text-muted-foreground mb-4">{activeHazard.reason}</p>
               
               {activeHazard.photo_url && (
                 <img src={activeHazard.photo_url} alt="Hazard" className="w-full h-40 object-cover rounded-xl mb-4 border" />
               )}
               
               <div className="flex gap-3">
                 <button className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 min-h-[48px]" 
                         onClick={() => { confirmReport(activeHazard.id, true).then(refreshReports); setActiveHazardId(null); }}>
                   <Check size={18}/> Still there
                 </button>
                 <button className="flex-1 py-3 bg-muted text-foreground rounded-xl text-sm font-bold hover:bg-muted/80 flex items-center justify-center gap-2 min-h-[48px]"
                         onClick={() => { confirmReport(activeHazard.id, false).then(refreshReports); setActiveHazardId(null); }}>
                   <X size={18}/> Gone
                 </button>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}