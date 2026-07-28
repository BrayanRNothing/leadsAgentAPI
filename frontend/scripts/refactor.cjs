const fs = require('fs');
let code = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');

const imports = "import React, { useEffect, useRef, useCallback } from 'react';\nimport { useScraping } from '../context/ScrapingContext';";
code = code.replace(/import React, \{ useState, useEffect, useRef, useCallback \} from 'react';/, imports);

const hookVars = `  const {
    termino, setTermino,
    ubicacion, setUbicacion,
    termConfirmed, setTermConfirmed,
    termFeedback, setTermFeedback,
    isScanning, setIsScanning,
    isValidating, setIsValidating,
    synonyms, setSynonyms,
    sources, setSources,
    quantity, setQuantity,
    estimatedTime, setEstimatedTime,
    cooldown, setCooldown,
    showCompletionModal, setShowCompletionModal,
    showStartWarning, setShowStartWarning,
    completionStats, setCompletionStats,
    suggestions, setSuggestions,
    showSuggestions, setShowSuggestions,
    error, setError,
    results, setResults,
    busquedaId, setBusquedaId,
    mapCenter, setMapCenter,
    mapBounds, setMapBounds,
    routePaths, setRoutePaths,
    cityGeoJSON, setCityGeoJSON,
    selectedLead, setSelectedLead,
    loading, setLoading,
    logs, setLogs,
    eventSourceRef,
    safetyTimeoutRef
  } = useScraping();\n`;

code = code.replace('export default function ScrapingView({ onBack }) {', 'export default function ScrapingView({ onBack }) {\n' + hookVars);

const statesToRemove = [
  /^\s*const \[termino.*?;/m,
  /^\s*const \[ubicacion.*?;/m,
  /^\s*const \[termConfirmed.*?;/m,
  /^\s*const \[termFeedback.*?;/m,
  /^\s*const \[isScanning.*?;/m,
  /^\s*const \[isValidating.*?;/m,
  /^\s*const \[synonyms.*?;/m,
  /^\s*const \[sources.*?;/m,
  /^\s*const \[quantity.*?;/m,
  /^\s*const \[estimatedTime.*?;/m,
  /^\s*const \[cooldown.*?;/m,
  /^\s*const \[showCompletionModal.*?;/m,
  /^\s*const \[showStartWarning.*?;/m,
  /^\s*const \[completionStats.*?;/m,
  /^\s*const \[suggestions.*?;/m,
  /^\s*const \[showSuggestions.*?;/m,
  /^\s*const safetyTimeoutRef.*?;/m,
  /^\s*const \[logs, setLogs.*?;/m,
  /^\s*const logsEndRef.*?;\n/m,
  /^\s*const \[loading.*?;/m,
  /^\s*const \[results.*?;/m,
  /^\s*const \[busquedaId.*?;/m,
  /^\s*const \[error.*?;/m,
  /^\s*const \[mapCenter.*?;/m,
  /^\s*const \[mapBounds.*?;/m,
  /^\s*const \[routePaths.*?;/m,
  /^\s*const \[cityGeoJSON.*?;/m,
  /^\s*const \[selectedLead.*?;/m,
  /^\s*const eventSourceRef.*?;/m
];

statesToRemove.forEach(regex => {
  code = code.replace(regex, '');
});

// Re-add logsEndRef because it's a DOM ref, not context ref
code = code.replace('  // Diccionario local', '  const logsEndRef = useRef(null);\n\n  // Diccionario local');

fs.writeFileSync('src/components/ScrapingView.jsx', code);
console.log('Done');
