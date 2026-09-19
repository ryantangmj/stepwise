import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { parseProfile } from '@/lib/api';
import { PROFILE_PRESETS } from '@/lib/profiles';
import { Mic, Loader2, Sparkles, UserRound, ArrowRight, CheckCircle2 } from 'lucide-react';

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  wheelchair: "Avoids steps entirely, requires curb cuts at crossings, and keeps hills gentle (comfortable ≤5%, hard limit 8%).",
  walker: "Avoids steps entirely, prefers routes with rest spots, and tolerates slightly steeper hills (comfortable ≤6%, limit 10%).",
  cane: "Steps are allowed but penalized in favor of ramps, and hills up to 12% are tolerated.",
  custom: "Built specifically from your own description of your unique mobility needs."
};

const SPEECH_SUPPORTED = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export default function ProfileScreen() {
  const { profile, setProfile, customProfileSummary, setCustomProfileSummary, setCustomProfileId } = useAppStore();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [pending, setPending] = useState<{id: string, summary: string}|null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!SpeechRecognition) return;
    
    if(listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r:any) => r[0].transcript).join(" ");
      setText(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleParse = async () => {
    if(!text.trim()) return;
    setParsing(true); setError(null); setPending(null);
    try {
      const res = await parseProfile(text);
      setPending({id: res.profile_id, summary: res.summary});
    } catch(err: any) {
      setError(err.message || "Failed to generate profile.");
    } finally {
      setParsing(false);
    }
  };

  const confirmParsed = () => {
    if(!pending) return;
    setCustomProfileId(pending.id);
    setCustomProfileSummary(pending.summary);
    setProfile('custom');
    setPending(null);
    setText('');
  };

  return (
    <div className="h-full w-full bg-background overflow-y-auto">
      <div className="max-w-4xl mx-auto p-5 md:p-12 space-y-8 md:space-y-12 pb-12">
        
        <header className="space-y-4 md:space-y-6 max-w-2xl mt-4 md:mt-0">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 text-primary rounded-2xl md:rounded-3xl flex items-center justify-center shadow-inner">
            <UserRound size={32} strokeWidth={2.5} className="md:w-10 md:h-10" />
          </div>
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">Mobility Profile</h1>
            <p className="text-base md:text-xl font-medium text-muted-foreground leading-relaxed">
              Stepwise uses this to choose routes that stay comfortable for you—avoiding steps, steep hills, and known hazards.
            </p>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Presets */}
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Standard Presets</h2>
            <div className="space-y-4">
              {PROFILE_PRESETS.map(p => {
                const active = profile === p.name;
                const Icon = p.icon;
                return (
                  <button 
                    key={p.name}
                    onClick={() => setProfile(p.name)}
                    className={`w-full text-left p-5 md:p-6 rounded-3xl border-2 transition-all duration-300 group min-h-[80px] ${active ? 'border-primary bg-primary/5 shadow-lg scale-[1.02] md:scale-100' : 'border-border bg-card hover:border-primary/40 hover:shadow-md'}`}
                  >
                    <div className="text-lg md:text-xl font-extrabold flex items-center gap-4 mb-3">
                      <div className={`p-2.5 rounded-xl ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors'}`}>
                        <Icon size={24} />
                      </div>
                      {p.label}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground leading-relaxed pl-14">
                      {PROFILE_DESCRIPTIONS[p.name]}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom AI Profile */}
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-3">
              <Sparkles className="text-secondary" size={24} /> Custom AI Profile
            </h2>
            
            {profile === 'custom' && customProfileSummary && (
              <div className="p-5 md:p-6 rounded-3xl bg-primary text-primary-foreground shadow-xl animate-in fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <div className="font-extrabold mb-3 text-base md:text-lg relative z-10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  Active Custom Profile
                </div>
                <p className="text-primary-foreground/90 font-medium leading-relaxed relative z-10 text-sm md:text-base">{customProfileSummary}</p>
              </div>
            )}

            <div className="p-5 md:p-6 rounded-3xl border-2 border-dashed border-border bg-card/50 space-y-5 md:space-y-6">
              <label className="block text-sm md:text-base font-bold text-foreground">Describe your specific needs</label>
              <div className="flex gap-2 md:gap-3">
                <textarea 
                  value={text} onChange={e=>setText(e.target.value)}
                  placeholder="e.g. I use a rollator, get tired after 200m, and want to avoid busy crossings..."
                  className="flex-1 rounded-2xl border-2 p-4 md:p-5 min-h-[140px] resize-none focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 bg-background font-medium transition-all text-base"
                />
                {SPEECH_SUPPORTED && (
                  <button 
                    onClick={toggleListening}
                    className={`w-14 md:w-16 shrink-0 rounded-2xl flex items-center justify-center transition-all min-h-[56px] ${listening ? 'bg-destructive text-destructive-foreground animate-pulse shadow-lg' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}`}
                  >
                    <Mic size={24} className="md:w-7 md:h-7" />
                  </button>
                )}
              </div>
              {error && <p className="text-sm font-bold text-destructive">{error}</p>}
              <button 
                onClick={handleParse} disabled={!text.trim() || parsing}
                className="w-full py-4 md:py-5 min-h-[56px] rounded-2xl bg-secondary text-secondary-foreground font-extrabold text-base md:text-lg shadow-xl hover:shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
              >
                {parsing ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                Generate Profile
              </button>
            </div>

            {pending && (
              <div className="p-5 md:p-6 rounded-3xl bg-secondary/10 border-2 border-secondary/30 space-y-4 md:space-y-5 animate-in slide-in-from-top-6 shadow-lg">
                <h3 className="font-extrabold text-secondary-foreground text-base md:text-lg">Here's what we understood:</h3>
                <p className="text-secondary-foreground/80 font-medium leading-relaxed text-sm md:text-base">{pending.summary}</p>
                <button onClick={confirmParsed} className="w-full py-4 min-h-[56px] bg-secondary text-secondary-foreground rounded-2xl font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base">
                  <CheckCircle2 size={20} /> Looks right — Apply Profile
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}