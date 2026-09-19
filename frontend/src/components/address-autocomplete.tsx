import { useState, useEffect, useRef } from "react";
import { X, Loader2, MapPin } from "lucide-react";
import { geocodeAddress } from "@/lib/api";
import { GeocodeResult, LatLon } from "@/lib/types";

export function AddressAutocomplete({ 
  label, placeholder, value, onSelect, active, onToggleActive, autoFocus, icon 
}: {
  label: string; placeholder: string; value: string;
  onSelect: (p: LatLon, name: string) => void;
  active: boolean; onToggleActive: () => void;
  autoFocus?: boolean;
  icon?: React.ReactNode;
}) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(query);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced || debounced === value) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    geocodeAddress(debounced).then(res => {
      if(cancelled) return;
      setResults(res);
      setSelectedIndex(0);
    }).finally(() => {
      if(!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debounced, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        onSelect({ lat: results[selectedIndex].lat, lon: results[selectedIndex].lon }, results[selectedIndex].display_name);
        setFocused(false);
      }
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  };

  const showDropdown = focused && query.length > 0 && query !== value;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className={`flex items-center gap-2 rounded-2xl border-2 transition-all bg-card min-h-[52px] ${focused ? 'border-primary shadow-[0_0_0_2px_rgba(29,78,216,0.1)]' : 'border-border'}`}>
        <div className="pl-4 text-muted-foreground shrink-0">{icon}</div>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setFocused(true); }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 py-3 bg-transparent text-base md:text-sm font-medium focus:outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button onClick={() => { setQuery(""); setFocused(true); }} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 transition-colors">
            <X size={18} />
          </button>
        )}
        <button
          onClick={onToggleActive}
          className={`px-4 py-2 mr-2 my-1 rounded-xl font-bold text-xs md:text-sm transition-colors shrink-0 min-h-[40px] flex items-center justify-center ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          title={`Tap map to set ${label}`}
        >
          Map
        </button>
      </div>

      {showDropdown && (
        <div className="absolute z-50 top-[calc(100%+8px)] left-0 right-0 bg-popover text-popover-foreground rounded-2xl shadow-xl border overflow-hidden animate-in fade-in slide-in-from-top-2">
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground text-sm font-medium">
              <Loader2 size={18} className="animate-spin mr-2" /> Searching...
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-[280px] overflow-y-auto py-2">
              {results.map((r, i) => (
                <li 
                  key={i}
                  className={`px-4 py-3 min-h-[48px] text-base md:text-sm cursor-pointer flex items-start gap-3 transition-colors ${i === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                  onClick={() => {
                    onSelect({ lat: r.lat, lon: r.lon }, r.display_name);
                    setFocused(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <MapPin size={18} className={`mt-0.5 shrink-0 ${i === selectedIndex ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="line-clamp-2 font-medium leading-snug">{r.display_name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-base md:text-sm font-medium text-muted-foreground bg-muted/20">
              No exact matches found. Try tapping the map instead.
            </div>
          )}
        </div>
      )}
    </div>
  );
}