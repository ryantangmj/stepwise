import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigResponse, ProfileName, LatLon } from './types';
import { getConfig } from './api';

interface AppState {
  config: ConfigResponse | null;
  profile: ProfileName;
  setProfile: (p: ProfileName) => void;
  customProfileId: string | null;
  setCustomProfileId: (id: string | null) => void;
  customProfileSummary: string | null;
  setCustomProfileSummary: (s: string | null) => void;
  start: LatLon | null;
  setStart: (p: LatLon | null) => void;
  startName: string;
  setStartName: (n: string) => void;
  end: LatLon | null;
  setEnd: (p: LatLon | null) => void;
  endName: string;
  setEndName: (n: string) => void;
  reportsVersion: number;
  refreshReports: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [profile, setProfile] = useState<ProfileName>("wheelchair");
  const [customProfileId, setCustomProfileId] = useState<string | null>(null);
  const [customProfileSummary, setCustomProfileSummary] = useState<string | null>(null);
  const [start, setStart] = useState<LatLon | null>(null);
  const [startName, setStartName] = useState("");
  const [end, setEnd] = useState<LatLon | null>(null);
  const [endName, setEndName] = useState("");
  const [reportsVersion, setReportsVersion] = useState(0);

  useEffect(() => {
    getConfig().then(cfg => {
      setConfig(cfg);
      if(cfg.demo_start) {
        setStart(cfg.demo_start);
        setStartName("Ophelia Street, Pittsburgh");
      }
      if(cfg.demo_end) {
        setEnd(cfg.demo_end);
        setEndName("Hamburg Hall, Pittsburgh");
      }
    });
  }, []);

  return (
    <AppContext.Provider value={{
      config, profile, setProfile, customProfileId, setCustomProfileId,
      customProfileSummary, setCustomProfileSummary,
      start, setStart, startName, setStartName,
      end, setEnd, endName, setEndName,
      reportsVersion, refreshReports: () => setReportsVersion(v => v + 1)
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppStore = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
};