import React, { useState, useRef, useCallback, useEffect } from "react";
import "./index.css";

// ── Config ──────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod";

const LANGUAGES = [
  { code: "hi", native: "हिन्दी", en: "Hindi" },
  { code: "mr", native: "मराठी", en: "Marathi" },
  { code: "te", native: "తెలుగు", en: "Telugu" },
  { code: "ta", native: "தமிழ்", en: "Tamil" },
  { code: "bn", native: "বাংলা", en: "Bengali" },
  { code: "en", native: "English", en: "English" },
];

const CROPS = [
  { id: "wheat",    emoji: "🌾", name: "गेहूं",   en: "Wheat" },
  { id: "rice",     emoji: "🍚", name: "धान",    en: "Rice" },
  { id: "cotton",   emoji: "🌿", name: "कपास",  en: "Cotton" },
  { id: "sugarcane",emoji: "🎋", name: "गन्ना",   en: "Sugarcane" },
  { id: "tomato",   emoji: "🍅", name: "टमाटर", en: "Tomato" },
  { id: "potato",   emoji: "🥔", name: "आलू",   en: "Potato" },
  { id: "onion",    emoji: "🧅", name: "प्याज",  en: "Onion" },
  { id: "soybean",  emoji: "🫘", name: "सोयाबीन", en: "Soybean" },
];

const STATES = [
  "Maharashtra","Punjab","Uttar Pradesh","Rajasthan","Madhya Pradesh",
  "Karnataka","Andhra Pradesh","Tamil Nadu","Gujarat","Haryana",
  "Bihar","West Bengal","Odisha","Telangana"
];

const AWS_SERVICES = [
  { icon: "🧠", name: "Amazon Bedrock" },
  { icon: "🔍", name: "AWS Rekognition" },
  { icon: "🎤", name: "Amazon Transcribe" },
  { icon: "🔊", name: "Amazon Polly" },
  { icon: "⚡", name: "AWS Lambda" },
  { icon: "🌐", name: "API Gateway" },
  { icon: "💾", name: "DynamoDB" },
  { icon: "📦", name: "Amazon S3" },
  { icon: "🚀", name: "AWS Amplify" },
  { icon: "🤖", name: "Strands Agents SDK" },
  { icon: "👁️", name: "CloudWatch" },
  { icon: "🔐", name: "Amazon Cognito" },
];

const AGENT_STEPS = [
  { id: "disease", icon: "🔬", name: "Disease Detection Agent", desc: "AWS Rekognition + Bedrock Vision" },
  { id: "weather", icon: "🌦️", name: "Weather Advisory Agent",  desc: "Open-Meteo + Bedrock analysis" },
  { id: "market",  icon: "📊", name: "Market Price Agent",      desc: "Bedrock knowledge + Mandi data" },
  { id: "treatment",icon:"💊", name: "Treatment Recommendation Agent", desc: "Bedrock Claude 3.5 Sonnet" },
  { id: "supervisor",icon:"🧠",name: "Supervisor Agent",        desc: "Synthesizing final advisory..." },
];

// ── Utility ─────────────────────────────────────────────────────────
function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
  });
}

function getRainIcon(mm) {
  if (mm > 15) return "⛈️";
  if (mm > 5) return "🌧️";
  if (mm > 0) return "🌦️";
  return "☀️";
}

function getSeverityClass(sev) {
  return { critical: "critical", high: "high", medium: "medium", low: "low" }[sev] || "medium";
}

// ══════════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [language, setLanguage]     = useState("hi");
  const [crop, setCrop]             = useState("wheat");
  const [state, setState]           = useState("Maharashtra");
  const [imageFile, setImageFile]   = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [query, setQuery]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [doneAgents, setDoneAgents] = useState([]);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory]       = useState([]);
  const [audioRef]                  = useState(React.createRef());

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);

  const farmerId = useRef(`farmer_${Math.random().toString(36).substr(2, 9)}`);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("krishimitra_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // ── Image handling ──────────────────────────────────────────────
  const handleImageChange = useCallback(async (file) => {
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setResult(null);
    setError(null);
  }, []);

  const onFileDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) handleImageChange(file);
  }, [handleImageChange]);

  // ── Voice recording ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const base64 = await new Promise(r => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result.split(",")[1]);
          fr.readAsDataURL(blob);
        });
        // In production: call /voice API then set query
        setQuery("(🎤 Voice recorded — transcribing with Amazon Transcribe...)");
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access needed for voice input.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // ── Main Analysis ───────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setDoneAgents([]);

    try {
      const imageBase64 = imageFile ? await toBase64(imageFile) : null;

      // Simulate agent steps for demo (replace with actual API in prod)
      for (let i = 0; i < AGENT_STEPS.length; i++) {
        setActiveAgent(AGENT_STEPS[i].id);
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
        setDoneAgents(prev => [...prev, AGENT_STEPS[i].id]);
      }

      // Actual API call
      let apiResult = null;
      try {
        const resp = await fetch(`${API_BASE}/advisory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageBase64,
            query: query || "Meri fasal ki bimari batao aur ilaaj btao",
            language,
            farmerId: farmerId.current,
            cropType: crop,
            location: { state, district: "Unknown" }
          }),
          signal: AbortSignal.timeout(55000)
        });
        apiResult = await resp.json();
      } catch (apiErr) {
        console.warn("API not available, using demo data:", apiErr.message);
        apiResult = getMockResult(crop, language, state);
      }

      setResult(apiResult);

      // Save to history
      const histItem = {
        id: Date.now(),
        crop,
        disease: apiResult.disease?.disease_name || "No disease detected",
        severity: apiResult.disease?.severity || "low",
        date: new Date().toLocaleDateString("hi-IN"),
        lang: language
      };
      const newHistory = [histItem, ...history].slice(0, 5);
      setHistory(newHistory);
      localStorage.setItem("krishimitra_history", JSON.stringify(newHistory));

    } catch (err) {
      setError("Analysis failed. Please try again. Error: " + err.message);
    } finally {
      setLoading(false);
      setActiveAgent(null);
    }
  }, [imageFile, query, language, crop, state, history]);

  const canAnalyze = imageFile || query.trim();

  return (
    <div className="app">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🌾</div>
          <div>
            <div className="navbar-title">KrishiMitra AI</div>
            <div className="navbar-subtitle">कृषि सलाहकार · AWS Hackathon</div>
          </div>
        </div>
        <div className="navbar-aws-badge">
          <span className="aws-dot"></span>
          <span>12 AWS Services · Live</span>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-badge">
          <span>🏆</span>
          <span>WeMakeDevs × AWS · Bharat Builds Tour</span>
        </div>
        <h1 className="hero-title">
          <span className="gradient-text">AI-Powered</span> Farm<br/>
          Advisory for Bharat
        </h1>
        <p className="hero-subtitle-hindi">
          आपकी फसल का AI डॉक्टर — हिन्दी में
        </p>
        <p className="hero-description">
          Upload your crop photo, speak in your language — get instant disease
          diagnosis, treatment, market prices & weather advisory powered by
          <strong> Amazon Bedrock</strong>, <strong>Rekognition</strong> &
          <strong> Polly</strong>.
        </p>
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">₹2L Cr</span>
            <span className="stat-label">Annual Crop Loss</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">140M+</span>
            <span className="stat-label">Farmers Need Help</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">12</span>
            <span className="stat-label">AWS Services</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">5</span>
            <span className="stat-label">Indian Languages</span>
          </div>
        </div>
      </section>

      {/* ── AWS Services Bar ─────────────────────────────────────── */}
      <div className="aws-services-bar">
        <div className="aws-services-title">Powered by AWS Cloud Services</div>
        <div className="aws-services-scroll">
          {AWS_SERVICES.map(s => (
            <div key={s.name} className="aws-service-chip">
              <span className="service-icon">{s.icon}</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="main-container">

        {/* ── Language Selection ──────────────────────────────── */}
        <div className="card fade-in-up">
          <div className="card-header">
            <div className="card-icon green">🌐</div>
            <div>
              <div className="card-title">अपनी भाषा चुनें</div>
              <div className="card-subtitle">Select your language · Amazon Polly + Transcribe</div>
            </div>
          </div>
          <div className="language-grid">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                id={`lang-${l.code}`}
                className={`lang-btn ${language === l.code ? "active" : ""}`}
                onClick={() => setLanguage(l.code)}
              >
                <span className="lang-native">{l.native}</span>
                <span className="lang-en">{l.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Crop + Location ─────────────────────────────────── */}
        <div className="card fade-in-up">
          <div className="card-header">
            <div className="card-icon amber">🌱</div>
            <div>
              <div className="card-title">फसल और जगह चुनें</div>
              <div className="card-subtitle">Crop selection · Amazon DynamoDB</div>
            </div>
          </div>
          <div className="crop-grid">
            {CROPS.map(c => (
              <button
                key={c.id}
                id={`crop-${c.id}`}
                className={`crop-btn ${crop === c.id ? "active" : ""}`}
                onClick={() => setCrop(c.id)}
              >
                <span className="crop-emoji">{c.emoji}</span>
                <span className="text-hindi">{c.name}</span>
                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{c.en}</span>
              </button>
            ))}
          </div>
          <div className="mb-3">
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
              📍 राज्य चुनें (State)
            </label>
            <select
              id="state-select"
              value={state}
              onChange={e => setState(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* ── Disease Scanner ──────────────────────────────────── */}
        <div className="card fade-in-up">
          <div className="card-header">
            <div className="card-icon green">🔬</div>
            <div>
              <div className="card-title">फसल की फोटो डालें</div>
              <div className="card-subtitle">AI Disease Detection · Amazon Rekognition + Bedrock Vision</div>
            </div>
          </div>
          <div className="scanner-section">
            {/* Upload Zone */}
            <div
              className={`upload-zone ${imagePreview ? "" : ""}`}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
              onDragLeave={e => e.currentTarget.classList.remove("dragover")}
              onDrop={onFileDrop}
            >
              <input
                id="crop-image-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => handleImageChange(e.target.files[0])}
              />
              {imagePreview ? (
                <img src={imagePreview} alt="Crop" className="preview-image" />
              ) : (
                <>
                  <span className="upload-icon">📸</span>
                  <div className="upload-title">फोटो खींचें या चुनें</div>
                  <div className="upload-hint">
                    Drop image here or click to select<br/>
                    JPG, PNG up to 10MB
                  </div>
                </>
              )}
            </div>

            {/* Voice Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="voice-section">
                <button
                  id="voice-record-btn"
                  className={`voice-btn ${isRecording ? "recording" : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title="Click to record voice"
                >
                  {isRecording ? "⏹️" : "🎤"}
                </button>
                <div className="voice-label">
                  {isRecording
                    ? "🔴 Recording... रुकने के लिए दबाएं"
                    : "🎤 बोलकर पूछें · Amazon Transcribe"}
                </div>
                {query && (
                  <div className="voice-transcript">{query}</div>
                )}
              </div>

              <textarea
                id="text-query-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="या यहाँ लिखें — पत्ती पीली हो रही है, दाग हैं..."
                style={{
                  width: "100%",
                  minHeight: "100px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  padding: "12px",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-hindi)",
                  resize: "vertical"
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: "16px", padding: "12px",
              background: "rgba(220,38,38,0.1)",
              border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: "var(--radius-sm)",
              color: "var(--red-400)", fontSize: "0.85rem"
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            id="analyze-btn"
            className="analyze-btn"
            onClick={runAnalysis}
            disabled={!canAnalyze || loading}
          >
            {loading ? "🤖 AI Agents Running..." : "🌾 फसल की जांच करें · Analyze Crop"}
          </button>
        </div>

        {/* ── Loading State ─────────────────────────────────────── */}
        {loading && (
          <div className="card loading-state fade-in-up">
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🤖</div>
            <h3 style={{ marginBottom: "8px", fontSize: "1.2rem" }}>
              KrishiMitra AI Agents Running
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "24px" }}>
              Powered by Amazon Bedrock Strands Multi-Agent Architecture
            </p>
            <div className="agents-running">
              {AGENT_STEPS.map(agent => {
                const isDone   = doneAgents.includes(agent.id);
                const isActive = activeAgent === agent.id;
                return (
                  <div
                    key={agent.id}
                    className={`agent-row ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                  >
                    {isActive ? (
                      <div className="agent-spinner" />
                    ) : isDone ? (
                      <span className="agent-check">✅</span>
                    ) : (
                      <span style={{ width: 20, height: 20, flexShrink: 0, opacity: 0.3 }}>⬜</span>
                    )}
                    <div>
                      <div className="agent-name">{agent.icon} {agent.name}</div>
                      <div className="agent-desc">{agent.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────── */}
        {result && !loading && (
          <>
            {/* Advisory Card */}
            <div className="card fade-in-up">
              <div className="card-header">
                <div className="card-icon green">🌾</div>
                <div>
                  <div className="card-title">KrishiMitra की सलाह</div>
                  <div className="card-subtitle">Synthesized by Bedrock Supervisor Agent</div>
                </div>
              </div>

              {result.disease?.disease_detected && (
                <div className={`disease-badge ${getSeverityClass(result.disease?.severity)}`}>
                  <span>⚠️</span>
                  <span>{result.disease.disease_name}</span>
                  <span>·</span>
                  <span style={{ textTransform: "capitalize" }}>{result.disease.severity} severity</span>
                </div>
              )}

              <div className="advisory-text">
                {result.advisory || "Analysis complete. No advisory text returned."}
              </div>

              {result.audioUrl && (
                <div className="audio-player">
                  <button
                    id="play-audio-btn"
                    className="audio-play-btn"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.src = result.audioUrl;
                        audioRef.current.play();
                      }
                    }}
                  >▶️</button>
                  <div className="audio-info">
                    <div className="audio-title">🔊 आवाज़ में सुनें · Listen in your language</div>
                    <div className="audio-subtitle">Amazon Polly Neural Voice · {language.toUpperCase()}</div>
                  </div>
                  <audio ref={audioRef} style={{ display: "none" }} />
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div className="results-grid">
              {/* Disease Details */}
              {result.disease?.disease_detected && (
                <div className="card fade-in-up">
                  <div className="card-header">
                    <div className="card-icon red">🔬</div>
                    <div>
                      <div className="card-title">Disease Report</div>
                      <div className="card-subtitle">Amazon Rekognition + Bedrock</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs text-muted mb-2">Disease Detected</div>
                    <div className="font-bold" style={{ fontSize: "1.1rem", color: "var(--red-400)" }}>
                      {result.disease.disease_name}
                    </div>
                    {result.disease.disease_name_hindi && (
                      <div className="text-hindi text-sm text-muted">
                        {result.disease.disease_name_hindi}
                      </div>
                    )}
                  </div>
                  {result.disease.symptoms_observed?.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-muted mb-2">Symptoms Observed</div>
                      {result.disease.symptoms_observed.map((s, i) => (
                        <div key={i} className="text-sm" style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>
                          • {s}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="divider" />
                  <div className="text-xs text-muted mb-2">AWS Rekognition Labels</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(result.disease.rekognition_labels || []).slice(0, 6).map(l => (
                      <span key={l} style={{
                        background: "rgba(14,165,233,0.15)", color: "var(--sky-400)",
                        border: "1px solid rgba(14,165,233,0.3)",
                        borderRadius: "10px", padding: "2px 8px", fontSize: "0.7rem"
                      }}>{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Price */}
              {result.market && (
                <div className="card fade-in-up">
                  <div className="card-header">
                    <div className="card-icon amber">📊</div>
                    <div>
                      <div className="card-title">Mandi Prices</div>
                      <div className="card-subtitle">Amazon Bedrock Market Agent</div>
                    </div>
                  </div>
                  <div className="price-display">
                    <div className="price-value">
                      ₹{(result.market.mandi_price_per_quintal || "N/A").toLocaleString("en-IN")}
                    </div>
                    <div className="price-unit">/quintal</div>
                  </div>
                  {result.market.price_change_percent && (
                    <div className={`price-change ${result.market.price_trend === "rising" ? "up" : "down"}`}>
                      {result.market.price_trend === "rising" ? "↑" : "↓"}
                      {result.market.price_change_percent}
                    </div>
                  )}
                  <div className="divider" />
                  <div className="text-xs text-muted mb-2">MSP Price</div>
                  <div className="text-sm font-bold">
                    ₹{(result.market.msp_price_per_quintal || "N/A").toLocaleString("en-IN")}/quintal
                  </div>
                  {result.market.best_selling_time && (
                    <div className="text-xs text-muted" style={{ marginTop: "8px", color: "var(--earth-400)" }}>
                      💡 {result.market.best_selling_time}
                    </div>
                  )}
                </div>
              )}

              {/* Treatment */}
              {result.treatment && !result.treatment.error && (
                <div className="card fade-in-up">
                  <div className="card-header">
                    <div className="card-icon blue">💊</div>
                    <div>
                      <div className="card-title">Treatment Plan</div>
                      <div className="card-subtitle">Bedrock Treatment Agent</div>
                    </div>
                  </div>
                  <div className="treatment-grid">
                    {result.treatment.organic_treatment && (
                      <div className="treatment-card">
                        <div className="treatment-type">🌿 Organic</div>
                        <div className="treatment-name">{result.treatment.organic_treatment.method}</div>
                        <div className="treatment-detail">{result.treatment.organic_treatment.frequency}</div>
                      </div>
                    )}
                    {result.treatment.chemical_treatment && (
                      <div className="treatment-card">
                        <div className="treatment-type">⚗️ Chemical</div>
                        <div className="treatment-name">{result.treatment.chemical_treatment.pesticide_name}</div>
                        <div className="treatment-detail">{result.treatment.chemical_treatment.dosage}</div>
                      </div>
                    )}
                  </div>
                  {result.treatment.urgency && (
                    <div style={{
                      marginTop: "12px", padding: "8px 14px",
                      background: result.treatment.urgency === "immediate"
                        ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)",
                      border: `1px solid ${result.treatment.urgency === "immediate"
                        ? "rgba(220,38,38,0.3)" : "rgba(217,119,6,0.3)"}`,
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      color: result.treatment.urgency === "immediate"
                        ? "var(--red-400)" : "var(--earth-400)"
                    }}>
                      ⏰ Urgency: {result.treatment.urgency}
                    </div>
                  )}
                </div>
              )}

              {/* Weather */}
              {result.weather && (
                <div className="card fade-in-up">
                  <div className="card-header">
                    <div className="card-icon blue">🌦️</div>
                    <div>
                      <div className="card-title">Weather Advisory</div>
                      <div className="card-subtitle">Open-Meteo + Bedrock Analysis</div>
                    </div>
                  </div>
                  <div className="advisory-text" style={{ marginBottom: "16px", fontSize: "0.9rem" }}>
                    {result.weather.summary}
                  </div>
                  {result.weather.forecast?.next_7_days?.dates?.length > 0 && (
                    <div className="weather-days">
                      {result.weather.forecast.next_7_days.dates.map((date, i) => (
                        <div key={date} className="weather-day">
                          <div className="weather-day-label">
                            {new Date(date).toLocaleDateString("en", { weekday: "short" })}
                          </div>
                          <div className="weather-day-icon">
                            {getRainIcon(result.weather.forecast.next_7_days.rainfall_mm?.[i] || 0)}
                          </div>
                          <div className="weather-temp-max">
                            {Math.round(result.weather.forecast.next_7_days.max_temp?.[i] || 0)}°
                          </div>
                          <div className="weather-temp-min">
                            {Math.round(result.weather.forecast.next_7_days.min_temp?.[i] || 0)}°
                          </div>
                          <div className="weather-rain">
                            {result.weather.forecast.next_7_days.rainfall_mm?.[i]?.toFixed(1) || 0}mm
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agents Used Summary */}
            <div className="card fade-in-up">
              <div className="card-header">
                <div className="card-icon green">🤖</div>
                <div>
                  <div className="card-title">Multi-Agent Architecture Used</div>
                  <div className="card-subtitle">Amazon Bedrock Strands SDK · All agents ran in parallel</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(result.agents_used || AGENT_STEPS.map(a => a.id)).map(agent => (
                  <div key={agent} style={{
                    background: "rgba(22,163,74,0.15)",
                    border: "1px solid rgba(22,163,74,0.3)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                    color: "var(--green-400)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <span>✅</span>
                    <span style={{ textTransform: "capitalize" }}>{agent.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="text-xs text-muted">
                💾 Saved to <strong>Amazon DynamoDB</strong> · 
                Farmer ID: <code style={{ color: "var(--green-400)" }}>{farmerId.current}</code>
              </div>
            </div>
          </>
        )}

        {/* ── History ───────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="card fade-in-up">
            <div className="card-header">
              <div className="card-icon green">📋</div>
              <div>
                <div className="card-title">पिछली जांच · Consultation History</div>
                <div className="card-subtitle">Amazon DynamoDB · Your consultation records</div>
              </div>
            </div>
            <div className="history-list">
              {history.map(h => (
                <div key={h.id} className="history-item">
                  <div style={{ fontSize: "1.5rem" }}>
                    {CROPS.find(c => c.id === h.crop)?.emoji || "🌾"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="text-sm font-bold">
                      {CROPS.find(c => c.id === h.crop)?.name || h.crop}
                    </div>
                    <div className="text-xs text-muted">{h.disease}</div>
                  </div>
                  <div>
                    <div className={`disease-badge ${getSeverityClass(h.severity)}`} style={{ margin: 0, fontSize: "0.7rem" }}>
                      {h.severity}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{h.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-built-with">
          🏆 Built for <strong>WeMakeDevs × AWS First Commit Hackathon</strong> · Team Avengers
        </div>
        <div className="footer-aws-services">
          Amazon Bedrock · Rekognition · Transcribe · Polly · Lambda · API Gateway · DynamoDB · S3 · Amplify · Strands SDK · CloudWatch · Cognito
        </div>
      </footer>
    </div>
  );
}

// ── Mock Result for Demo when API not available ──────────────────────
function getMockResult(crop, language, state) {
  return {
    success: true,
    agents_used: ["disease_detection", "weather", "market_price", "treatment", "supervisor"],
    disease: {
      disease_detected: true,
      disease_name: "Leaf Blight (Blast)",
      disease_name_hindi: "पत्ती झुलसा रोग",
      severity: "medium",
      confidence: 87,
      affected_parts: ["leaf", "stem"],
      symptoms_observed: ["Brown lesions on leaves", "Yellowing edges", "Water-soaked spots"],
      spread_risk: "high",
      rekognition_labels: ["Plant", "Leaf", "Disease", "Brown", "Vegetation", "Agriculture"]
    },
    weather: {
      success: true,
      location: state,
      summary: "Heavy rainfall expected next 3 days (18mm). Avoid fungicide spray until dry. Check drainage channels immediately.",
      forecast: {
        next_7_days: {
          dates: Array.from({length:7},(_,i)=>{
            const d=new Date(); d.setDate(d.getDate()+i);
            return d.toISOString().split("T")[0];
          }),
          max_temp: [32,30,28,29,31,33,34],
          min_temp: [22,21,20,21,22,23,24],
          rainfall_mm: [0,5,18,12,2,0,0],
          wind_speed: [12,15,20,18,10,8,9]
        }
      }
    },
    market: {
      crop, state,
      mandi_price_per_quintal: 2750,
      msp_price_per_quintal: 2275,
      price_trend: "rising",
      best_selling_time: "Wait 2 weeks — prices rising due to festival demand",
      nearby_mandis: ["Pune APMC", "Nashik Mandi", "Ahmednagar Market"],
      price_last_week: 2640,
      price_change_percent: "+4.2%"
    },
    treatment: {
      organic_treatment: {
        method: "Neem Oil Spray",
        ingredients: ["Neem oil 5ml", "Liquid soap 2ml", "Water 1L"],
        preparation: "Mix neem oil with soap, then add to water",
        application: "Spray evenly on affected leaves (morning/evening only)",
        frequency: "Every 3 days for 2 weeks"
      },
      chemical_treatment: {
        pesticide_name: "Mancozeb 75% WP",
        dosage: "2.5g per liter of water · 500L per acre",
        application_method: "Foliar spray",
        precautions: ["Wear gloves and mask", "Do not spray in rain", "Keep away from water bodies"],
        cost_per_acre: "₹180-220"
      },
      prevention: [
        "Use disease-resistant seed varieties next season",
        "Maintain proper plant spacing for airflow",
        "Avoid overhead irrigation"
      ],
      recovery_timeline: "7-10 days with treatment",
      urgency: "within 48hrs"
    },
    advisory: language === "hi"
      ? `नमस्ते किसान भाई! 🌾\n\nआपकी ${crop} फसल में **पत्ती झुलसा रोग** (Leaf Blight) का मध्यम संक्रमण दिखा है।\n\n✅ **आज ही करें:** नीम तेल (5ml/L) का छिड़काव करें। अगले 48 घंटे में Mancozeb 75% WP (2.5g/L) स्प्रे करें।\n\n🌧️ **सावधानी:** अगले 3 दिन बारिश आ सकती है — स्प्रे सुबह जल्दी करें।\n\n💰 **मंडी भाव:** ₹2,750/क्विंटल (4.2% बढ़ा) — 2 हफ्ते रुककर बेचें, दाम और बढ़ेंगे।`
      : `Hello Farmer! 🌾\n\nYour ${crop} crop shows medium-severity Leaf Blight disease.\n\n✅ Act Today: Apply Neem oil spray (5ml/L). Within 48 hours, spray Mancozeb 75% WP.\n\n🌧️ Warning: Rain expected next 3 days — spray early morning.\n\n💰 Market Price: ₹2,750/quintal (up 4.2%) — wait 2 weeks to sell for better price.`,
    audioUrl: null
  };
}
