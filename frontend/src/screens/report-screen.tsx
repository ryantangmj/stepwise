import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAppStore } from '@/lib/store';
import { createReport } from '@/lib/api';
import { MapView } from '@/components/map-view';
import { LatLon, ReportOut } from '@/lib/types';
import { SEVERITY_COLOR, SEVERITY_LABEL, HAZARD_TYPE_LABEL, PASSABILITY_STYLE } from '@/lib/profiles';
import { Camera, MapPin, CheckCircle2, ArrowRight, Loader2, RefreshCcw } from 'lucide-react';

export default function ReportScreen() {
  const [, setLocation] = useLocation();
  const { config, start, refreshReports } = useAppStore();
  const [step, setStep] = useState<'capture'|'confirm'|'result'>('capture');
  const [photoPreview, setPhotoPreview] = useState<string|null>(null);
  const [photoFile, setPhotoFile] = useState<File|null>(null);
  const [loc, setLoc] = useState<LatLon>(start || config?.demo_start || {lat: 0, lon: 0});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportOut|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setStep('confirm');
    if(navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
         pos => setLoc({lat: pos.coords.latitude, lon: pos.coords.longitude}),
         () => {}, {timeout: 5000}
       );
    }
  };

  const handleSubmit = async () => {
    if(!photoFile) return;
    setSubmitting(true);
    try {
      const r = await createReport({ photo: photoFile, lat: loc.lat, lon: loc.lon, note });
      setResult(r);
      refreshReports();
      setStep('result');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if(!config) return null;

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-background overflow-hidden">
      
      {/* Map Panel (Top on mobile, Right on desktop) */}
      <div className="h-[30vh] min-h-[180px] md:min-h-[auto] md:h-full md:flex-1 relative order-1 md:order-2 bg-muted/20 shrink-0 z-0">
         <MapView 
           bbox={config.bbox} start={null} end={null} routeData={null} reports={[]}
           interactiveMarker={loc}
           pickMode={step === 'confirm' ? 'location' : null}
           onMapClick={(p) => { if(step==='confirm') setLoc(p); }}
         />
      </div>

      {/* Scrollable Form Panel (Bottom on mobile, Left on desktop) */}
      <div className="flex-1 md:w-96 lg:w-[500px] shrink-0 border-r bg-card overflow-y-auto order-2 md:order-1 shadow-[0_-12px_40px_-10px_rgba(0,0,0,0.15)] md:shadow-2xl z-10 flex flex-col relative rounded-t-[2rem] md:rounded-none -mt-6 md:mt-0">
        
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0 bg-card sticky top-0 z-20">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
        
        <div className="p-5 md:p-8 flex-1 flex flex-col pb-8">
          {step === 'capture' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6 md:space-y-8 animate-in fade-in py-8">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 shadow-inner">
                <Camera size={48} strokeWidth={1.5} className="md:w-14 md:h-14" />
              </div>
              <div className="space-y-3 md:space-y-4 px-2">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Report a Barrier</h2>
                <p className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
                  Snap a photo of a blocked sidewalk, broken curb, or steep ramp. Our AI analyzes the hazard and updates routing for everyone instantly.
                </p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 md:py-5 min-h-[56px] bg-primary text-primary-foreground rounded-2xl font-extrabold text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3"
              >
                <Camera size={24} /> Take a Photo
              </button>
            </div>
          )}

          {step === 'confirm' && photoPreview && (
            <div className="space-y-8 animate-in slide-in-from-right-4 py-2">
              <div className="space-y-2">
                <h3 className="font-extrabold text-xl flex items-center gap-2"><MapPin className="text-primary"/> Confirm Location</h3>
                <p className="text-sm font-medium text-muted-foreground">Tap the map panel to adjust the exact spot.</p>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-bold text-xs md:text-sm text-muted-foreground uppercase tracking-wider">Attached Photo</h3>
                <div className="relative rounded-2xl overflow-hidden border-2 shadow-sm group">
                  <img src={photoPreview} className="w-full h-48 object-cover" alt="Preview"/>
                  <button onClick={()=>fileInputRef.current?.click()} className="absolute bottom-3 right-3 bg-black/70 text-white px-4 py-2 min-h-[44px] rounded-xl text-xs font-bold backdrop-blur-md opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <RefreshCcw size={16}/> Retake
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-xs md:text-sm text-muted-foreground uppercase tracking-wider">Additional Note (Optional)</h3>
                <textarea 
                  value={note} onChange={e=>setNote(e.target.value)}
                  placeholder="Any details to help others?"
                  className="w-full rounded-2xl border-2 p-4 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none font-medium transition-all text-base min-h-[100px]" rows={3}
                />
              </div>

              <div className="flex flex-col md:flex-row gap-3 pt-4">
                <button onClick={()=>setStep('capture')} className="px-6 py-4 min-h-[56px] rounded-2xl border-2 font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-base md:text-lg">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-4 min-h-[56px] rounded-2xl bg-primary text-primary-foreground font-extrabold text-base md:text-lg shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0">
                  {submitting ? <><Loader2 className="animate-spin" size={20}/> Analyzing...</> : 'Submit Report'}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-8 py-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <CheckCircle2 size={40} strokeWidth={2} className="md:w-12 md:h-12" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-tight">Analyzed Successfully</h2>
              
              <div className="p-5 md:p-6 rounded-3xl bg-card border-2 shadow-lg space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="pr-4">
                    <h3 className="font-extrabold text-lg md:text-xl">{HAZARD_TYPE_LABEL[result.hazard_type]}</h3>
                    <p className="text-sm md:text-base font-medium text-muted-foreground mt-2 leading-relaxed">{result.reason}</p>
                  </div>
                  <span className="shrink-0 px-3 py-1.5 rounded-full text-[10px] md:text-xs font-extrabold text-white shadow-sm tracking-wide uppercase" style={{backgroundColor: SEVERITY_COLOR[result.severity]}}>
                    {SEVERITY_LABEL[result.severity]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-3 pt-6 border-t relative z-10">
                  {(['wheelchair', 'walker', 'cane'] as const).map(k => {
                    const style = PASSABILITY_STYLE[result.passability[k]];
                    const Icon = style.Icon;
                    return (
                      <div key={k} className={`p-2 md:p-3 rounded-2xl text-center border-2 border-transparent ${style.bg} ${style.text}`}>
                        <div className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest mb-2 opacity-80">{k}</div>
                        <div className="text-xs md:text-sm font-bold flex flex-col items-center gap-1.5">
                          <Icon size={18} className="md:w-5 md:h-5" />
                          {style.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button onClick={() => setLocation('/')} className="w-full py-4 md:py-5 min-h-[56px] bg-primary text-primary-foreground rounded-2xl font-extrabold text-base md:text-lg flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 transition-all mt-4">
                Back to Map <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}