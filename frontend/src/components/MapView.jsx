import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Marcador SVG tipo Pin de Mapa (Teardrop)
const createDotIcon = (color = '#3b82f6', isSelected = false) => {
  const scale = isSelected ? 1.2 : 1;
  const shadow = isSelected ? 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))' : 'drop-shadow(0px 2px 4px rgba(0,0,0,0.25))';
  
  return L.divIcon({
    html: `<div style="transform: scale(${scale}); filter: ${shadow}; transition: all 0.2s; display: flex; align-items: center; justify-content: center; transform-origin: bottom center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3.5" fill="white" stroke="none"></circle>
      </svg>
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const dotIcon        = createDotIcon('#3b82f6');
const selectedIcon   = createDotIcon('#ef4444', true);
const scanningIcon   = createDotIcon('#06b6d4');

// Renderizador SVG con padding masivo para que Leaflet no corte la malla
// al arrastrar rápidamente (padding: 4 significa 4 veces el tamaño de la pantalla
// en cada dirección para pre-renderizar la malla entera).
const customSvgRenderer = L.svg({ padding: 4 });

function MapUpdater({ selectedLead }) {
  const map = useMap();

  useEffect(() => {
    if (selectedLead?.lat && selectedLead?.lng) {
      map.flyTo([selectedLead.lat, selectedLead.lng], 16, { duration: 1.2 });
    }
    // Removida la lógica de 'center' para que el mapa no te quite el control (ni el zoom) 
    // mientras escanea o buscas.
  }, [map, selectedLead]);
  return null;
}

// Renders clipped wave-pulse animation inside selected state polygons.
// Injects directly into Leaflet's overlayPane SVG so layer-pixel coords align perfectly.
function ScanningWaves({ geometries }) {
  const map = useMap();
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!geometries || geometries.length === 0) return;
    const NS = 'http://www.w3.org/2000/svg';

    // Find Leaflet's internal SVG pane (already uses layer pixel coords)
    const pane = map.getPane('overlayPane');
    const svgEl = pane?.querySelector('svg');
    if (!svgEl) return;

    const uid = `sw-${Date.now()}`;

    // Container group
    const rootG = document.createElementNS(NS, 'g');
    rootG.setAttribute('id', uid);
    rootG.style.pointerEvents = 'none';
    svgEl.appendChild(rootG);

    // Track clip ids for cleanup on rebuild
    const createdClipIds = [];

    const buildPath = (geom) => {
      const rings = geom.type === 'Polygon' ? geom.coordinates
        : geom.type === 'MultiPolygon' ? geom.coordinates.flat(1)
        : [];
      return rings.map(ring =>
        ring.map((c, i) => {
          const pt = map.latLngToLayerPoint([c[1], c[0]]);
          return `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        }).join(' ') + ' Z'
      ).join(' ');
    };

    const buildScene = () => {
      while (rootG.firstChild) rootG.removeChild(rootG.firstChild);
      // Remove only our clip paths
      createdClipIds.forEach(id => {
        const el = svgEl.querySelector(`#${id}`);
        if (el) el.remove();
      });
      createdClipIds.length = 0;

      // Ensure defs exists
      let defsEl = svgEl.querySelector('defs');
      if (!defsEl) {
        defsEl = document.createElementNS(NS, 'defs');
        svgEl.insertBefore(defsEl, svgEl.firstChild);
      }

      geometries.forEach((geom, gi) => {
        try {
          const clipId = `${uid}-clip-${gi}`;
          const d = buildPath(geom);
          if (!d) return;

          // Clip path in layer pixel space
          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', clipId);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          const clipShape = document.createElementNS(NS, 'path');
          clipShape.setAttribute('d', d);
          clip.appendChild(clipShape);
          defsEl.appendChild(clip);
          createdClipIds.push(clipId);

          const g = document.createElementNS(NS, 'g');
          g.setAttribute('clip-path', `url(#${clipId})`);
          rootG.appendChild(g);

          // Filled polygon overlay
          const fill = document.createElementNS(NS, 'path');
          fill.setAttribute('d', d);
          fill.setAttribute('fill', '#22d3ee');
          fill.setAttribute('fill-opacity', '0.07');
          fill.setAttribute('stroke', '#22d3ee');
          fill.setAttribute('stroke-width', '1.5');
          fill.setAttribute('stroke-opacity', '0.55');
          g.appendChild(fill);

          // Wave ring metrics
          const geomLayer = L.geoJSON(geom);
          const gb = geomLayer.getBounds();
          const centerPt = map.latLngToLayerPoint(gb.getCenter());
          const swPt = map.latLngToLayerPoint(gb.getSouthWest());
          const nePt = map.latLngToLayerPoint(gb.getNorthEast());
          const maxR = Math.max(Math.abs(swPt.x - nePt.x), Math.abs(swPt.y - nePt.y)) * 0.88;
          const WAVES = 5;
          const WAVE_DUR = 2800;

          for (let w = 0; w < WAVES; w++) {
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', centerPt.x.toFixed(1));
            circle.setAttribute('cy', centerPt.y.toFixed(1));
            circle.setAttribute('r', '0');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', '#06b6d4');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('stroke-opacity', '0');
            circle.dataset.delay = String(w * (WAVE_DUR / WAVES));
            circle.dataset.maxR = String(maxR);
            g.appendChild(circle);
          }
        } catch (_) {}
      });
    };

    buildScene();
    // Leaflet uses CSS transforms on the overlayPane during pan, so the SVG
    // stays visually aligned. We only need to recompute pixel coords after
    // the map settles (moveend/zoomend), not on every move frame.
    map.on('moveend zoomend', buildScene);

    // rAF animation
    let start = null;
    const DURATION = 2800;
    const animate = (ts) => {
      if (!start) start = ts;
      rootG.querySelectorAll('circle[data-delay]').forEach(c => {
        const delay = parseFloat(c.dataset.delay);
        const maxR = parseFloat(c.dataset.maxR);
        const t = ((ts - start + delay) % DURATION) / DURATION;
        const opacity = t < 0.15 ? t / 0.15 : 1 - t;
        c.setAttribute('r', (t * maxR).toFixed(1));
        c.setAttribute('stroke-opacity', (Math.max(0, opacity) * 0.7).toFixed(3));
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.off('moveend zoomend', buildScene);
      try { rootG.remove(); } catch (_) {}
      // Clean up our clip paths from defs
      createdClipIds.forEach(id => {
        try { svgEl.querySelector(`#${id}`)?.remove(); } catch (_) {}
      });
    };
  }, [geometries, map]);

  return null;
}



export default function MapView({ leads = [], center, bounds, isScanning, cityGeoJSON, selectedStates = [], onMapClick, selectedLead, logs = [] }) {
  const [mexicoStates, setMexicoStates] = useState(null);
  const geoJsonRef = useRef();

  const defaultCenter = [23.6345, -102.5528];
  const defaultZoom   = 5;

  // Normalize: cityGeoJSON can be a single geometry or null (multi-select handled via selectedStates)
  // selectedStates: array of { name, geometry, bounds }
  const selectedStatesRef = useRef(selectedStates);
  useEffect(() => {
    selectedStatesRef.current = selectedStates;
  }, [selectedStates]);

  const selectedGeometries = selectedStates.map(s => s.geometry).filter(Boolean);
  // For scanning animation also include single cityGeoJSON (backwards compat)
  const scanGeometries = selectedGeometries.length > 0 ? selectedGeometries
    : cityGeoJSON ? [cityGeoJSON] : [];

  useEffect(() => {
    fetch('/mexico.json')
      .then(r => r.json())
      .then(setMexicoStates)
      .catch(e => console.error('Error cargando mexico.json', e));
  }, []);

  const stateStyle = {
    fillColor: '#a5b4fc',
    fillOpacity: 0.1,
    color: '#818cf8',
    weight: 1,
    opacity: 0.5,
  };

  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: e => {
        const isSelected = selectedStatesRef.current.some(s => s.name === feature.properties.name);
        if (!isSelected) {
          e.target.setStyle({ weight: 1.5, color: '#6366f1', fillOpacity: 0.22 });
          e.target.bringToFront();
        }
      },
      mouseout: e => {
        const isSelected = selectedStatesRef.current.some(s => s.name === feature.properties.name);
        if (!isSelected && geoJsonRef.current) geoJsonRef.current.resetStyle(e.target);
      },
      click: e => {
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
        if (!isScanning && onMapClick) {
          const b = e.target.getBounds();
          onMapClick(e.latlng, feature.properties.name, feature.geometry, [
            [b.getSouthWest().lat, b.getSouthWest().lng],
            [b.getNorthEast().lat, b.getNorthEast().lng],
          ]);
        }
      },
    });
  };

  // Style for selected states
  const styleForFeature = (feature) => {
    const isSelected = selectedStates.some(s => s.name === feature.properties.name);
    if (isSelected) {
      return {
        fillColor: '#6366f1',
        fillOpacity: 0.18,
        color: '#6366f1',
        weight: 2.5,
        opacity: 0.9,
      };
    }
    return stateStyle;
  };

  // Imperatively update styles when selection changes — avoids GeoJSON remount
  useEffect(() => {
    if (!geoJsonRef.current) return;
    geoJsonRef.current.eachLayer(layer => {
      const name = layer.feature?.properties?.name;
      if (!name) return;
      const isSelected = selectedStates.some(s => s.name === name);
      layer.setStyle(
        isSelected
          ? { fillColor: '#6366f1', fillOpacity: 0.18, color: '#6366f1', weight: 2.5, opacity: 0.9 }
          : stateStyle
      );
    });
  }, [selectedStates]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden"
      style={{ boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.5), inset -4px -4px 10px rgba(255,255,255,0.8)' }}
    >
      <style>{`
        .leaflet-popup-content-wrapper {
          background: #e0e5ec;
          border-radius: 16px !important;
          box-shadow: 6px 6px 14px rgba(163,177,198,0.5), -4px -4px 10px rgba(255,255,255,0.85) !important;
          border: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip { background: #e0e5ec !important; }
        .leaflet-popup-close-button { color: #94a3b8 !important; top: 8px !important; right: 10px !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-container { background: #e8ecf0; }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-control-zoom { display: none !important; }
        .scanning-pulse { animation: sPulse 2s ease-in-out infinite; }
        @keyframes sPulse { 0%,100% { fill-opacity: 0.05; } 50% { fill-opacity: 0.2; } }
      `}</style>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        zoomControl={false}
        renderer={customSvgRenderer}
      >
        {/* Tile CartoDB Voyager — carga tiles con configuración por defecto de Leaflet para evitar bugs */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          keepBuffer={4}
        />

        <MapUpdater
          selectedLead={selectedLead}
        />

        {/* Estados de México — sin key para evitar remount durante drag */}
        {mexicoStates && (
          <GeoJSON
            ref={geoJsonRef}
            data={mexicoStates}
            style={styleForFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Scanning wave animation — clipped inside polygon */}
        {isScanning && scanGeometries.length > 0 && (
          <ScanningWaves geometries={scanGeometries} />
        )}

        {/* Marcadores */}
        {leads.map((lead, idx) => {
          let lat = lead.lat;
          let lng = lead.lng;
          if (!lat || !lng) {
            if (!center) return null;
            const s = lead.nombre || String(idx);
            let h = 0;
            for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
            lat = center[0] + ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.08;
            lng = center[1] + ((Math.abs(h * 7) % 1000) / 1000 - 0.5) * 0.08;
          }
          const isSel = selectedLead?.nombre === lead.nombre;
          return (
            <Marker
              key={lead.id || idx}
              position={[lat, lng]}
              icon={isSel ? selectedIcon : (isScanning ? scanningIcon : dotIcon)}
              zIndexOffset={isSel ? 1000 : 0}
            >
              <Popup>
                <div className="p-3 min-w-[170px] max-w-[210px]">
                  <p className="font-black text-gray-800 text-sm leading-tight mb-1">{lead.nombre}</p>
                  {lead.categoria && (
                    <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full mb-2">
                      {lead.categoria}
                    </span>
                  )}
                  <div className="space-y-1">
                    {lead.telefono && <p className="text-xs text-gray-600">📞 {lead.telefono}</p>}
                    {lead.correo   && <p className="text-xs text-green-600 font-medium truncate">✉ {lead.correo}</p>}
                    {lead.sitioWeb && (
                      <p className="text-xs text-blue-500">
                        🌐 <a href={lead.sitioWeb} target="_blank" rel="noreferrer" className="hover:underline truncate">
                          {lead.sitioWeb.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                        </a>
                      </p>
                    )}
                    {!lead.telefono && !lead.correo && !lead.sitioWeb && (
                      <p className="text-[10px] text-gray-400 italic">Sin datos de contacto</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Mini Terminal / Badge escaneo */}
      {isScanning && (
        <div
          className="absolute top-3 left-3 z-30 flex flex-col pointer-events-none overflow-hidden rounded-xl"
          style={{ 
            background: 'rgba(255, 255, 255, 0.85)', 
            backdropFilter: 'blur(12px)', 
            boxShadow: '3px 3px 8px rgba(163,177,198,0.5),-3px -3px 8px rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.4)',
            width: '260px'
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50 border-b border-gray-200/50">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="text-[11px] font-bold text-cyan-700 tracking-wide uppercase">
              Escaneando {selectedStates.length > 1 ? `${selectedStates.length} estados` : 'zona'}
            </span>
          </div>
          
          {/* Terminal Logs (últimos 3) */}
          <div className="flex flex-col gap-1 p-2 font-mono text-[9px] text-gray-600">
            {logs.length === 0 ? (
              <span className="text-gray-400 italic px-1">Iniciando bot...</span>
            ) : (
              logs.slice(-3).map((log, i) => (
                <div key={i} className="flex gap-1.5 px-1">
                  <span className="text-cyan-500 font-bold shrink-0">&gt;</span>
                  <span className="line-clamp-2 leading-tight">{log}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Badge estados seleccionados (sin escanear) */}
      {!isScanning && selectedStates.length > 0 && (
        <div
          className="absolute top-3 left-3 z-30 flex flex-col gap-1 pointer-events-none"
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(224,229,236,0.95)', backdropFilter: 'blur(8px)', boxShadow: '3px 3px 8px rgba(163,177,198,0.5),-3px -3px 8px rgba(255,255,255,0.8)' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span className="text-xs font-bold text-indigo-600 tracking-wide">
              {selectedStates.length === 1
                ? selectedStates[0].name
                : `${selectedStates.length} estados seleccionados`}
            </span>
          </div>
          {selectedStates.length > 1 && (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {selectedStates.map(s => (
                <span
                  key={s.name}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
