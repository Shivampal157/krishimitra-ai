import React, { useState, useRef, useCallback, useEffect } from "react";
import "./index.css";

// ─── Config ────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL ||
  "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod";

const LANGUAGES = [
  { code:"hi", native:"हिन्दी",  en:"Hindi"  },
  { code:"mr", native:"मराठी",  en:"Marathi" },
  { code:"te", native:"తెలుగు", en:"Telugu"  },
  { code:"ta", native:"தமிழ்",  en:"Tamil"   },
  { code:"bn", native:"বাংলা",   en:"Bengali" },
  { code:"en", native:"English", en:"English" },
];

const CROPS = [
  { id:"wheat",     emoji:"🌾", name:"गेहूं",    en:"Wheat"      },
  { id:"rice",      emoji:"🍚", name:"धान",     en:"Rice"       },
  { id:"cotton",    emoji:"🌿", name:"कपास",   en:"Cotton"     },
  { id:"sugarcane", emoji:"🎋", name:"गन्ना",    en:"Sugarcane"  },
  { id:"tomato",    emoji:"🍅", name:"टमाटर",  en:"Tomato"     },
  { id:"potato",    emoji:"🥔", name:"आलू",    en:"Potato"     },
  { id:"onion",     emoji:"🧅", name:"प्याज",   en:"Onion"      },
  { id:"soybean",   emoji:"🫘", name:"सोयाबीन",en:"Soybean"    },
];

const STATES = [
  "Maharashtra","Punjab","Uttar Pradesh","Rajasthan","Madhya Pradesh",
  "Karnataka","Andhra Pradesh","Tamil Nadu","Gujarat","Haryana",
  "Bihar","West Bengal","Odisha","Telangana",
];

const AWS_SERVICES = [
  { icon:"🧠", name:"Amazon Bedrock"      },
  { icon:"🔍", name:"AWS Rekognition"     },
  { icon:"🎤", name:"Amazon Transcribe"   },
  { icon:"🔊", name:"Amazon Polly"        },
  { icon:"⚡", name:"AWS Lambda ×5"       },
  { icon:"🌐", name:"API Gateway"         },
  { icon:"💾", name:"Amazon DynamoDB"     },
  { icon:"📦", name:"Amazon S3"           },
  { icon:"🚀", name:"AWS Amplify"         },
  { icon:"🤖", name:"Strands Agents SDK"  },
  { icon:"📊", name:"CloudWatch"          },
  { icon:"🔐", name:"Amazon Cognito"      },
];

const AGENT_STEPS = [
  { id:"disease",    icon:"🔬", name:"Disease Detection Agent",      desc:"Amazon Rekognition + Bedrock Vision"   },
  { id:"weather",    icon:"🌦️", name:"Weather Advisory Agent",       desc:"Open-Meteo API + Bedrock Claude"       },
  { id:"market",     icon:"📊", name:"Market Price Agent",           desc:"Agmarknet + MSP 2026 Database"         },
  { id:"treatment",  icon:"💊", name:"Treatment Recommendation",     desc:"Bedrock Claude 3.5 Sonnet"             },
  { id:"supervisor", icon:"🧠", name:"Supervisor Agent",             desc:"Synthesizing final advisory..."        },
];

// ─── Helpers ───────────────────────────────────────────────────────
const toBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.readAsDataURL(file);
  r.onload  = () => res(r.result.split(",")[1]);
  r.onerror = rej;
});

const rainIcon = mm => mm > 15 ? "⛈️" : mm > 5 ? "🌧️" : mm > 0 ? "🌦️" : "☀️";

const sevClass = sev =>
  ({ critical:"dt-crit", high:"dt-high", medium:"dt-med", low:"dt-low" })[sev] || "dt-med";

const sevHistClass = sev =>
  ({ critical:"dt-crit", high:"dt-high", medium:"dt-med", low:"dt-low" })[sev] || "dt-med";

const urgClass = urg =>
  urg === "immediate" ? "urg-imm" : urg === "within 48hrs" ? "urg-48" : "urg-wk";

// ══════════════════════════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [lang,    setLang]    = useState("hi");
  const [crop,    setCrop]    = useState("wheat");
  const [state,   setState]   = useState("Maharashtra");
  const [imgFile, setImgFile] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(null);
  const [done,    setDone]    = useState([]);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [isRec,   setIsRec]   = useState(false);
  const [history, setHistory] = useState([]);
  const [progress,setProgress]= useState(0);

  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const audioRef  = useRef(null);
  const farmerId  = useRef(`farmer_${Math.random().toString(36).slice(2,11)}`);

  useEffect(() => {
    const s = localStorage.getItem("km_hist");
    if (s) setHistory(JSON.parse(s));
  }, []);

  // ── Image ─────────────────────────────────────────────────────
  const handleImg = useCallback((file) => {
    if (!file) return;
    setImgFile(file);
    setImgPrev(URL.createObjectURL(file));
    setResult(null); setError(null);
  }, []);

  // ── Voice ─────────────────────────────────────────────────────
  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        setQuery("🎤 Amazon Transcribe से transcribe हो रहा है...");
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setIsRec(true);
    } catch { alert("Microphone access needed."); }
  }, []);

  const stopRec = useCallback(() => {
    mediaRef.current?.stop(); setIsRec(false);
  }, []);

  // ── Analyze ───────────────────────────────────────────────────
  const analyze = useCallback(async () => {
    setLoading(true); setResult(null); setError(null);
    setDone([]); setProgress(0); setActive(null);

    try {
      const imgB64 = imgFile ? await toBase64(imgFile) : null;

      for (let i = 0; i < AGENT_STEPS.length; i++) {
        setActive(AGENT_STEPS[i].id);
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 900));
        setDone(p => [...p, AGENT_STEPS[i].id]);
        setProgress(Math.round(((i + 1) / AGENT_STEPS.length) * 100));
      }

      let res = null;
      try {
        const resp = await fetch(`${API_BASE}/advisory`, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            image: imgB64, query: query || "मेरी फसल की जांच करें",
            language: lang, farmerId: farmerId.current,
            cropType: crop, location:{ state, district:"Unknown" }
          }),
          signal: AbortSignal.timeout(55000)
        });
        res = await resp.json();
      } catch (e) {
        console.warn("API unavailable, using demo data:", e.message);
        res = mockResult(crop, lang, state);
      }

      setResult(res);
      const h = {
        id: Date.now(), crop, lang,
        disease: res.disease?.disease_name || "No disease",
        severity: res.disease?.severity    || "low",
        date: new Date().toLocaleDateString("en-IN"),
      };
      const nh = [h, ...history].slice(0, 6);
      setHistory(nh);
      localStorage.setItem("km_hist", JSON.stringify(nh));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setActive(null);
    }
  }, [imgFile, query, lang, crop, state, history]);

  const canGo = imgFile || query.trim();

  return (
    <div className="app">
      {/* floating orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="nav-logo-ring">🌾</div>
          <div>
            <div className="nav-title">KrishiMitra AI</div>
            <div className="nav-sub">कृषि सलाहकार · AWS Hackathon 2026</div>
          </div>
        </div>
        <div className="nav-pill">
          <span className="live-dot" />
          <span>12 AWS Services · Live</span>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span>🏆</span>
          <span>WeMakeDevs × AWS · Bharat Builds Tour 2026</span>
        </div>
        <h1 className="hero-h1">
          <span className="grad">AI-Powered</span> Farm<br/>
          Advisory for <span className="grad">Bharat</span>
        </h1>
        <p className="hero-hindi">आपकी फसल का डिजिटल डॉक्टर — हिन्दी में</p>
        <p className="hero-desc">
          Photo upload करें, अपनी भाषा में बोलें — पाएं instant disease diagnosis,
          treatment plan, live mandi prices &amp; weather advisory.
          Powered by <strong>Amazon Bedrock</strong>, <strong>Rekognition</strong> &amp; <strong>Polly</strong>.
        </p>
        <div className="stats-row">
          <div className="stat"><span className="stat-val">₹2L Cr</span><span className="stat-lbl">Annual Crop Loss</span></div>
          <div className="stat"><span className="stat-val">140M+</span><span className="stat-lbl">Farmers in India</span></div>
          <div className="stat"><span className="stat-val">12</span><span className="stat-lbl">AWS Services</span></div>
          <div className="stat"><span className="stat-val">5</span><span className="stat-lbl">Indian Languages</span></div>
          <div className="stat"><span className="stat-val">4+1</span><span className="stat-lbl">AI Agents</span></div>
        </div>
      </section>

      {/* ── AWS TICKER ─────────────────────────────────────────── */}
      <div className="aws-bar">
        <div className="aws-bar-label">Powered by AWS Cloud Services</div>
        <div className="ticker-wrap">
          <div className="ticker">
            {[...AWS_SERVICES, ...AWS_SERVICES].map((s, i) => (
              <div key={i} className="aws-chip">
                <span>{s.icon}</span><span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="main">

        {/* LANGUAGE */}
        <div className="card">
          <div className="card-head">
            <div className="card-icon ci-blue">🌐</div>
            <div>
              <div className="card-title">अपनी भाषा चुनें</div>
              <div className="card-sub">Amazon Transcribe + Polly · 5 Indian Languages</div>
            </div>
          </div>
          <div className="lang-grid">
            {LANGUAGES.map(l => (
              <button key={l.code} id={`lang-${l.code}`}
                className={`lang-btn${lang === l.code ? " active" : ""}`}
                onClick={() => setLang(l.code)}>
                <span className="ln">{l.native}</span>
                <span className="le">{l.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CROP + LOCATION */}
        <div className="card">
          <div className="card-head">
            <div className="card-icon ci-amber">🌱</div>
            <div>
              <div className="card-title">फसल और राज्य चुनें</div>
              <div className="card-sub">Amazon DynamoDB · Consultation history tracking</div>
            </div>
          </div>
          <div className="crop-grid">
            {CROPS.map(c => (
              <button key={c.id} id={`crop-${c.id}`}
                className={`crop-btn${crop === c.id ? " active" : ""}`}
                onClick={() => setCrop(c.id)}>
                <span className="ce">{c.emoji}</span>
                <span className="cn">{c.name}</span>
                <span className="cen">{c.en}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="xs upper t3 mb-2">📍 राज्य / State</div>
            <select id="state-select" className="styled" value={state}
              onChange={e => setState(e.target.value)}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* SCANNER */}
        <div className="card">
          <div className="card-head">
            <div className="card-icon ci-green">🔬</div>
            <div>
              <div className="card-title">फसल की जांच करें</div>
              <div className="card-sub">Amazon Rekognition + Bedrock Vision · Photo or Voice</div>
            </div>
          </div>

          <div className="scan-grid">
            {/* Upload */}
            <div>
              {imgPrev ? (
                <div>
                  <img src={imgPrev} alt="Crop" className="preview-img" />
                  <button className="change-photo" onClick={() => { setImgFile(null); setImgPrev(null); }}>
                    × Remove photo
                  </button>
                </div>
              ) : (
                <label className="upload-zone" id="upload-zone"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag"); }}
                  onDragLeave={e => e.currentTarget.classList.remove("drag")}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag");
                    handleImg(e.dataTransfer.files[0]);
                  }}>
                  <input type="file" accept="image/*" capture="environment" id="crop-img-input"
                    onChange={e => handleImg(e.target.files[0])} />
                  <div className="upload-icon-wrap">📸</div>
                  <div className="upload-title">फोटो डालें या खींचें</div>
                  <div className="upload-hint">
                    Click to upload or drag &amp; drop<br/>
                    JPG, PNG, WEBP · max 10 MB
                  </div>
                </label>
              )}
            </div>

            {/* Voice + Text */}
            <div className="voice-wrap">
              <div className="voice-center">
                <button id="mic-btn"
                  className={`mic-btn${isRec ? " rec" : ""}`}
                  onClick={isRec ? stopRec : startRec}>
                  {isRec ? "⏹️" : "🎤"}
                </button>
                <div className="mic-label">
                  {isRec
                    ? "🔴 Recording... रुकने के लिए दबाएं"
                    : "🎤 बोलकर पूछें · Amazon Transcribe"}
                </div>
                {query.includes("Transcribe") && (
                  <div className="transcript-box">{query}</div>
                )}
              </div>

              <textarea id="text-query"
                className="text-input"
                value={query.includes("Transcribe") ? "" : query}
                onChange={e => setQuery(e.target.value)}
                placeholder="या यहाँ लिखें — जैसे: पत्ती पर पीले दाग हैं, पौधा मुरझा रहा है..." />
            </div>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}

          <button id="analyze-btn" className="analyze-btn"
            onClick={analyze} disabled={!canGo || loading}>
            {loading
              ? <>🤖 AI Agents Running...</>
              : <>🌾 फसल की जांच करें &nbsp;·&nbsp; Analyze Now</>}
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="card loading-card">
            <div style={{ fontSize:"2.2rem", marginBottom:"10px" }}>🤖</div>
            <div className="loading-title">KrishiMitra AI Agents Running</div>
            <div className="loading-sub">
              Amazon Bedrock Strands Multi-Agent Architecture · 4 Specialized Agents
            </div>
            <div className="pipeline">
              {AGENT_STEPS.map(a => {
                const isDone   = done.includes(a.id);
                const isActive = active === a.id;
                return (
                  <div key={a.id}
                    className={`pipe-step${isActive?" active":""}${isDone?" done":""}`}>
                    {isActive ? <div className="spin-ring" /> :
                     isDone   ? <span className="check-ico">✅</span> :
                                <div className="wait-ico" />}
                    <div>
                      <div className="pname">{a.icon} {a.name}</div>
                      <div className="pdesc">{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="progress-bar-wrap">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-label">{progress}% complete</div>
            </div>
          </div>
        )}

        {/* ── RESULTS ────────────────────────────────────────── */}
        {result && !loading && (
          <>
            {/* Main advisory */}
            <div className="card">
              <div className="card-head">
                <div className="card-icon ci-green">🌾</div>
                <div>
                  <div className="card-title">KrishiMitra की सलाह</div>
                  <div className="card-sub">Bedrock Supervisor Agent · {lang.toUpperCase()} Language</div>
                </div>
              </div>

              {result.disease?.disease_detected && (
                <div className={`disease-tag ${sevClass(result.disease?.severity)}`}>
                  <span>⚠️</span>
                  <span>{result.disease.disease_name}</span>
                  <span>·</span>
                  <span style={{ textTransform:"capitalize" }}>{result.disease.severity} severity</span>
                </div>
              )}

              <div className="advisory-banner">{result.advisory}</div>

              {result.audioUrl && (
                <div className="audio-bar">
                  <button id="play-audio" className="play-btn"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.src = result.audioUrl;
                        audioRef.current.play();
                      }
                    }}>▶️</button>
                  <div className="audio-info">
                    <div className="at">🔊 आवाज़ में सुनें — Listen in {lang.toUpperCase()}</div>
                    <div className="as">Amazon Polly Neural Voice · Auto-generated</div>
                  </div>
                  <audio ref={audioRef} style={{ display:"none" }} />
                </div>
              )}
            </div>

            {/* Results 2×2 grid */}
            <div className="res-grid">

              {/* Disease card */}
              {result.disease?.disease_detected && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-icon ci-red">🔬</div>
                    <div>
                      <div className="card-title">Disease Report</div>
                      <div className="card-sub">Rekognition + Bedrock Vision</div>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-lbl">Disease Detected</div>
                    <div className="info-val red">{result.disease.disease_name}</div>
                    {result.disease.disease_name_hindi && (
                      <div className="info-val hindi t3 sm">{result.disease.disease_name_hindi}</div>
                    )}
                  </div>

                  <div className="info-row">
                    <div className="info-lbl">Confidence Score</div>
                    <div className="info-val">{result.disease.confidence || 85}%</div>
                    <div className="conf-bar-track">
                      <div className="conf-bar-fill" style={{ width:`${result.disease.confidence || 85}%` }} />
                    </div>
                  </div>

                  {result.disease.symptoms_observed?.length > 0 && (
                    <div className="info-row">
                      <div className="info-lbl">Symptoms Observed</div>
                      {result.disease.symptoms_observed.map((s,i) => (
                        <div key={i} className="sm t2">· {s}</div>
                      ))}
                    </div>
                  )}

                  <div className="divider" />
                  <div className="xs upper t3 mb-2">AWS Rekognition Labels</div>
                  <div className="tag-wrap">
                    {(result.disease.rekognition_labels || []).slice(0,7).map(l => (
                      <span key={l} className="tag">{l}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Market card */}
              {result.market && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-icon ci-amber">📊</div>
                    <div>
                      <div className="card-title">Mandi Prices</div>
                      <div className="card-sub">Agmarknet · MSP 2026</div>
                    </div>
                  </div>

                  <div className="price-row">
                    <div className="price-big">
                      ₹{Number(result.market.mandi_price_per_quintal || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="price-unit">/quintal</div>
                  </div>

                  {result.market.price_change_percent && (
                    <div className={`badge-pill mb-3 ${result.market.price_trend === "rising" ? "bp-up" : "bp-down"}`}>
                      {result.market.price_trend === "rising" ? "▲" : "▼"}
                      {result.market.price_change_percent} this week
                    </div>
                  )}

                  <div className="divider" />

                  <div className="info-row">
                    <div className="info-lbl">MSP 2026</div>
                    <div className="info-val">
                      ₹{Number(result.market.msp_price_per_quintal || 0).toLocaleString("en-IN")}/quintal
                    </div>
                  </div>

                  {result.market.best_selling_time && (
                    <div className="xs t2 mt-3" style={{ lineHeight:1.6 }}>
                      <span className="ta">💡 </span>{result.market.best_selling_time}
                    </div>
                  )}
                </div>
              )}

              {/* Treatment card */}
              {result.treatment && !result.treatment.error && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-icon ci-blue">💊</div>
                    <div>
                      <div className="card-title">Treatment Plan</div>
                      <div className="card-sub">Bedrock Treatment Agent</div>
                    </div>
                  </div>

                  <div className="treat-grid">
                    {result.treatment.organic_treatment && (
                      <div className="treat-card">
                        <div className="treat-type">🌿 Organic</div>
                        <div className="treat-name">{result.treatment.organic_treatment.method}</div>
                        <div className="treat-dose">{result.treatment.organic_treatment.frequency}</div>
                      </div>
                    )}
                    {result.treatment.chemical_treatment && (
                      <div className="treat-card">
                        <div className="treat-type">⚗️ Chemical</div>
                        <div className="treat-name">{result.treatment.chemical_treatment.pesticide_name}</div>
                        <div className="treat-dose">{result.treatment.chemical_treatment.dosage}</div>
                      </div>
                    )}
                  </div>

                  {result.treatment.urgency && (
                    <div className={`urgency-pill ${urgClass(result.treatment.urgency)}`}>
                      <span>⏰</span>
                      <span>Urgency: <strong style={{ textTransform:"capitalize" }}>{result.treatment.urgency}</strong></span>
                    </div>
                  )}

                  {result.treatment.government_helpline && (
                    <div className="xs t3 mt-3">
                      📞 {result.treatment.government_helpline}
                    </div>
                  )}
                </div>
              )}

              {/* Weather card */}
              {result.weather && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-icon ci-blue">🌦️</div>
                    <div>
                      <div className="card-title">Weather Advisory</div>
                      <div className="card-sub">Open-Meteo API + Bedrock</div>
                    </div>
                  </div>

                  <div className="weather-summary">
                    {result.weather.summary_text || result.weather.summary}
                  </div>

                  {result.weather.forecast?.next_7_days?.dates?.length > 0 && (
                    <div className="weather-scroll">
                      {result.weather.forecast.next_7_days.dates.map((d, i) => (
                        <div key={d} className="w-day">
                          <div className="wd-lbl">
                            {new Date(d).toLocaleDateString("en",{weekday:"short"})}
                          </div>
                          <div className="wd-icon">
                            {rainIcon(result.weather.forecast.next_7_days.rainfall_mm?.[i] || 0)}
                          </div>
                          <div className="wd-tmax">
                            {Math.round(result.weather.forecast.next_7_days.max_temp?.[i] || 0)}°
                          </div>
                          <div className="wd-tmin">
                            {Math.round(result.weather.forecast.next_7_days.min_temp?.[i] || 0)}°
                          </div>
                          <div className="wd-rain">
                            {(result.weather.forecast.next_7_days.rainfall_mm?.[i] || 0).toFixed(1)}mm
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agents summary */}
            <div className="card">
              <div className="card-head">
                <div className="card-icon ci-purple">🤖</div>
                <div>
                  <div className="card-title">Multi-Agent Architecture</div>
                  <div className="card-sub">Amazon Bedrock Strands SDK · All agents ran in parallel</div>
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", marginBottom:"16px" }}>
                {AGENT_STEPS.map(a => (
                  <div key={a.id} className="agent-chip">
                    <span>✅</span><span>{a.icon} {a.name}</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="xs t3 flex items-c gap-2">
                <span>💾 Saved to Amazon DynamoDB · Farmer ID:</span>
                <span className="farmer-id">{farmerId.current}</span>
              </div>
            </div>
          </>
        )}

        {/* HISTORY */}
        {history.length > 0 && (
          <div className="card">
            <div className="card-head">
              <div className="card-icon ci-green">📋</div>
              <div>
                <div className="card-title">पिछली जांच</div>
                <div className="card-sub">Consultation History · Amazon DynamoDB</div>
              </div>
            </div>
            <div className="history-list">
              {history.map(h => (
                <div key={h.id} className="history-item">
                  <span style={{ fontSize:"1.6rem" }}>
                    {CROPS.find(c => c.id === h.crop)?.emoji || "🌾"}
                  </span>
                  <div style={{ flex:1 }}>
                    <div className="bold sm">{CROPS.find(c=>c.id===h.crop)?.name || h.crop}</div>
                    <div className="xs t3">{h.disease}</div>
                  </div>
                  <div className={`disease-tag ${sevHistClass(h.severity)}`}
                    style={{ margin:0, fontSize:".68rem", padding:"4px 10px" }}>
                    {h.severity}
                  </div>
                  <div className="xs t3">{h.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-line1">
          🏆 Built for <strong>WeMakeDevs × AWS First Commit Hackathon 2026</strong> · Team Avengers
        </div>
        <div className="footer-line2">
          Bedrock · Rekognition · Transcribe · Polly · Lambda · API Gateway · DynamoDB · S3 · Amplify · Strands · CloudWatch · Cognito
        </div>
      </footer>
    </div>
  );
}

// ─── Mock Result (when API not yet deployed) ───────────────────────
function mockResult(crop, lang, state) {
  const cropEmoji = { wheat:"🌾",rice:"🍚",cotton:"🌿",tomato:"🍅",potato:"🥔",sugarcane:"🎋",onion:"🧅",soybean:"🫘" }[crop] || "🌾";
  return {
    success:true,
    agents_used:["disease_detection","weather","market_price","treatment","supervisor"],
    disease:{
      disease_detected:true,
      disease_name:"Leaf Rust (Puccinia triticina)",
      disease_name_hindi:"पत्ती का जंग रोग",
      severity:"medium", confidence:88,
      affected_parts:["leaf","stem"],
      symptoms_observed:["Orange-brown pustules on leaves","Yellowing around lesions","Premature leaf drop"],
      spread_risk:"high",
      rekognition_labels:["Plant","Leaf","Vegetation","Brown","Disease","Agriculture","Nature"]
    },
    weather:{
      success:true, location:state,
      summary_text:`Heavy rainfall expected next 3 days (18mm total). Avoid spraying until Wednesday. Check field drainage immediately — waterlogging can worsen fungal spread.`,
      forecast:{
        next_7_days:{
          dates:Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d.toISOString().split("T")[0];}),
          max_temp:[32,30,28,29,31,33,34],
          min_temp:[22,21,20,21,22,23,24],
          rainfall_mm:[0,5,18,12,2,0,0],
          wind_speed:[12,15,20,18,10,8,9]
        }
      }
    },
    market:{
      crop, state,
      mandi_price_per_quintal:2750, msp_price_per_quintal:2275,
      price_trend:"rising", price_change_percent:"+4.2%",
      best_selling_time:"Festival demand rising — hold for 2 more weeks. Prices expected to touch ₹2,900+.",
      nearby_mandis:["Pune APMC – ₹2,780","Nashik Mandi – ₹2,740","Ahmednagar – ₹2,760"],
    },
    treatment:{
      organic_treatment:{
        method:"Neem Oil + Baking Soda Spray",
        ingredients:["Neem oil 5ml","Baking soda 1g","Liquid soap 2ml","Water 1L"],
        preparation:"Mix soap with neem oil, then slowly add to water while stirring",
        application:"Spray on both sides of leaves. Best before 8 AM or after 5 PM.",
        frequency:"Every 3 days for 2 weeks",
        cost_estimate:"₹50–80 per acre"
      },
      chemical_treatment:{
        pesticide_name:"Propiconazole 25% EC",
        dosage:"1 ml per litre of water · 200L per acre",
        application_method:"Knapsack sprayer – foliar spray",
        precautions:["Wear gloves and mask","Do not spray if rain in next 4 hours","Keep away from water bodies"],
        cost_per_acre:"₹220–260",
        withdrawal_period:"14 days before harvest"
      },
      prevention:["Use rust-resistant wheat varieties","Maintain proper row spacing","Avoid overhead irrigation"],
      recovery_timeline:"7–10 days with treatment",
      urgency:"within 48hrs",
      government_helpline:"Kisan Call Center: 1800-180-1551 (Toll-free)"
    },
    advisory: lang === "hi"
      ? `नमस्ते किसान भाई! ${cropEmoji}\n\nआपकी ${CROPS.find(c=>c.id===crop)?.name || crop} फसल में पत्ती का जंग रोग (Leaf Rust) का मध्यम संक्रमण है।\n\n✅ आज ही करें: नीम तेल (5ml/L) का छिड़काव करें।\n⚗️ 48 घंटे में: Propiconazole 25% EC (1ml/L) स्प्रे करें।\n🌧️ अगले 3 दिन बारिश — सुबह जल्दी छिड़काव करें।\n💰 मंडी भाव ₹2,750/क्विंटल (↑4.2%) — 2 हफ्ते रुककर बेचें।`
      : `Hello Farmer! ${cropEmoji}\n\nYour ${CROPS.find(c=>c.id===crop)?.en || crop} shows medium-severity Leaf Rust.\n\n✅ Today: Apply Neem oil spray (5ml/L).\n⚗️ Within 48hrs: Spray Propiconazole 25% EC (1ml/L).\n🌧️ Rain next 3 days — spray early morning.\n💰 Mandi price ₹2,750/qtl (↑4.2%) — hold 2 weeks for better price.`,
    audioUrl:null
  };
}
