import React, { createContext, useContext, useState, useRef } from 'react';

const ScrapingContext = createContext(null);

export function ScrapingProvider({ children }) {
  const [selectedStates, setSelectedStates] = useState([]);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [termValidated, setTermValidated] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [scanStartTime, setScanStartTime] = useState(null);
  const [eta, setEta] = useState('');
  const [scanPhase, setScanPhase] = useState('idle');
  const [reqFilters, setReqFilters] = useState({ phone: false, email: false, website: false });

  const [termino, setTermino] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [termConfirmed, setTermConfirmed] = useState(false);
  const [termFeedback, setTermFeedback] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [synonyms, setSynonyms] = useState([]);
  const [sources, setSources] = useState({ maps: true, facebook: false });
  const [quantity, setQuantity] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('0 min');
  const [cooldown, setCooldown] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showStartWarning, setShowStartWarning] = useState(false);
  const [completionStats, setCompletionStats] = useState({ count: 0, term: '' });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  
  const [results, setResults] = useState([]);
  const [busquedaId, setBusquedaId] = useState(null);
  
  const [mapCenter, setMapCenter] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [routePaths, setRoutePaths] = useState([]);
  const [cityGeoJSON, setCityGeoJSON] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [logs, setLogs] = useState([]);
  const [pipelineStats, setPipelineStats] = useState({ descartados: 0, conCorreo: 0, totalExtraidos: 0 });

  // Store refs that need to survive unmounts (like SSE connections)
  const eventSourceRef = useRef(null);
  const safetyTimeoutRef = useRef(null);

  const value = {
    scanPhase, setScanPhase,
    reqFilters, setReqFilters,


    selectedStates, setSelectedStates,
    locationConfirmed, setLocationConfirmed,
    termValidated, setTermValidated,
    validationMessage, setValidationMessage,
    scanStartTime, setScanStartTime,
    eta, setEta,

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
    pipelineStats, setPipelineStats,
    eventSourceRef,
    safetyTimeoutRef
  };

  return (
    <ScrapingContext.Provider value={value}>
      {children}
    </ScrapingContext.Provider>
  );
}

export function useScraping() {
  const context = useContext(ScrapingContext);
  if (!context) {
    throw new Error('useScraping must be used within a ScrapingProvider');
  }
  return context;
}
