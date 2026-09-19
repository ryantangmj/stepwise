import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents, Pane } from 'react-leaflet';
import { LatLon, RouteResponse, ReportOut } from '@/lib/types';
import { HAZARD_TYPE_LABEL, SEVERITY_COLOR, SEVERITY_LABEL } from '@/lib/profiles';

interface MapViewProps {
  bbox: { north: number; south: number; east: number; west: number };
  start: LatLon | null;
  end: LatLon | null;
  routeData?: RouteResponse | null;
  reports?: ReportOut[];
  onMapClick?: (p: LatLon) => void;
  pickMode?: 'start' | 'end' | 'location' | null;
  activeHazardId?: string | null;
  onHazardClick?: (id: string) => void;
  interactiveMarker?: LatLon | null;
  focusLocation?: LatLon | null;
}

const createDivIcon = (html: string) => L.divIcon({
  html,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const START_ICON = createDivIcon('<div class="w-full h-full bg-[#16a34a] rounded-full border-[3px] border-white shadow-md"></div>');
const END_ICON = createDivIcon('<div class="w-full h-full bg-[#dc2626] rounded-md border-[3px] border-white shadow-md"></div>');
const INTERACTIVE_ICON = createDivIcon('<div class="w-full h-full bg-[#1d4ed8] rounded-full border-[3px] border-white shadow-md animate-pulse"></div>');
const HAZARD_ICON = L.divIcon({
  html: '<div class="stepwise-hazard-pin"><span>!</span></div>',
  className: '',
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -38],
});

function MapController(props: MapViewProps) {
  const map = useMap();

  useEffect(() => {
    const pts: L.LatLngTuple[] = [];
    if (props.start) pts.push([props.start.lat, props.start.lon]);
    if (props.end) pts.push([props.end.lat, props.end.lon]);
    if (props.interactiveMarker) pts.push([props.interactiveMarker.lat, props.interactiveMarker.lon]);

    if (props.routeData) {
      props.routeData.shortest.coordinates.forEach(c => pts.push([c[0], c[1]]));
      props.routeData.stepwise.coordinates.forEach(c => pts.push([c[0], c[1]]));
    }

    if (pts.length > 0) {
      map.flyToBounds(L.latLngBounds(pts), {
        paddingTopLeft: [44, 52],
        paddingBottomRight: [44, 48],
        maxZoom: 16,
        duration: 0.6,
      });
    } else if (props.reports?.length) {
      map.fitBounds(
        L.latLngBounds(props.reports.map(report => [report.lat, report.lon] as L.LatLngTuple)),
        { paddingTopLeft: [44, 52], paddingBottomRight: [44, 48], maxZoom: 16 },
      );
    } else {
      const mapBounds = L.latLngBounds(
        [props.bbox.south, props.bbox.west],
        [props.bbox.north, props.bbox.east]
      );
      map.fitBounds(mapBounds);
    }
  }, [map, props.bbox, props.start, props.end, props.interactiveMarker, props.routeData, props.reports]);

  useEffect(() => {
    if (!props.focusLocation) return;
    map.flyTo(
      [props.focusLocation.lat, props.focusLocation.lon],
      16,
      { duration: 0.55 },
    );
  }, [map, props.focusLocation]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (p: LatLon) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    }
  });
  return null;
}

export function MapView(props: MapViewProps) {
  const { bbox, start, end, routeData, reports = [], onMapClick, pickMode, activeHazardId, onHazardClick, interactiveMarker } = props;

  const initialBounds = useMemo(() => L.latLngBounds(
    [bbox.south, bbox.west],
    [bbox.north, bbox.east]
  ), [bbox]);

  return (
    <div className={`w-full h-full relative bg-muted/20 ${pickMode ? 'leaflet-crosshair' : ''}`}>
      <style>{`.leaflet-crosshair .leaflet-interactive, .leaflet-crosshair .leaflet-container { cursor: crosshair !important; }`}</style>
      
      <MapContainer 
        bounds={initialBounds} 
        zoom={15} 
        className="w-full h-full z-0" 
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController {...props} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Routes */}
        {routeData && (
          <Polyline 
            positions={routeData.shortest.coordinates}
            pathOptions={{ color: "#64748b", weight: 4, dashArray: "6 8", opacity: 0.7 }}
          />
        )}
        
        {routeData && (
          <Polyline 
            positions={routeData.stepwise.coordinates}
            pathOptions={{ color: "#1d4ed8", weight: 5, opacity: 0.9 }}
          />
        )}

        {/* Start / End / Interactive Marker */}
        {start && <Marker position={[start.lat, start.lon]} icon={START_ICON} />}
        {end && <Marker position={[end.lat, end.lon]} icon={END_ICON} />}
        {interactiveMarker && <Marker position={[interactiveMarker.lat, interactiveMarker.lon]} icon={INTERACTIVE_ICON} />}

        {/* Hazards */}
        <Pane name="hazards" style={{ zIndex: 450 }}>
          {reports.map(r => {
            const isActive = r.id === activeHazardId;
            return (
              <Marker
                key={r.id}
                position={[r.lat, r.lon]}
                icon={HAZARD_ICON}
                zIndexOffset={isActive ? 1000 : 500}
                eventHandlers={{
                  click: () => {
                    if (onHazardClick) onHazardClick(r.id);
                  }
                }}
              >
                <Popup className="stepwise-hazard-popup" minWidth={210}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: SEVERITY_COLOR[r.severity] || '#dc2626' }}
                      />
                      <strong className="text-sm">
                        {HAZARD_TYPE_LABEL[r.hazard_type] || r.hazard_type}
                      </strong>
                    </div>
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {SEVERITY_LABEL[r.severity] || `Severity ${r.severity}`}
                    </p>
                    <p className="m-0 text-sm leading-snug text-slate-700">{r.reason}</p>
                    <p className="m-0 text-xs font-semibold text-blue-700">
                      Tap the details below to confirm whether it is still there.
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </Pane>
      </MapContainer>

      {/* Pick Mode Overlay */}
      {pickMode && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-full text-sm font-bold shadow-xl pointer-events-none animate-in fade-in slide-in-from-top-4 flex items-center gap-2 z-[1000]">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"/>
          Tap the map to select location
        </div>
      )}
    </div>
  );
}