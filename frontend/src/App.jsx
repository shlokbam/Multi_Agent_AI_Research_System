import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Terminal, 
  Compass, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  RotateCw, 
  Copy, 
  Check, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Download,
  Key,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Info
} from 'lucide-react';
import './App.css';

const ensureString = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if (item.text) return item.text;
          return JSON.stringify(item);
        }
        return '';
      })
      .join('');
  }
  if (typeof val === 'object') {
    if (val.text) return val.text;
    return JSON.stringify(val);
  }
  return String(val);
};

export default function App() {
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: Search, 2: Scraping, 3: Drafting, 4: Critic, 5: Complete
  const [stepMessages, setStepMessages] = useState({
    1: 'Idle',
    2: 'Idle',
    3: 'Idle',
    4: 'Idle'
  });
  
  const [searchResults, setSearchResults] = useState('');
  const [scrapedContent, setScrapedContent] = useState('');
  const [report, setReport] = useState('');
  const [feedback, setFeedback] = useState('');
  
  const [activeTab, setActiveTab] = useState('report');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Custom API Key States
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mistral_api_key') || '');
  const [isKeyValid, setIsKeyValid] = useState(() => localStorage.getItem('mistral_api_key_valid') === 'true');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationError, setKeyValidationError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSettings, setShowSettings] = useState(() => localStorage.getItem('mistral_api_key_valid') !== 'true');

  // Extract score out of critic feedback (format: "Score: X/10")
  const getScore = () => {
    if (!feedback) return null;
    const match = feedback.match(/Score:\s*([0-9.]+)\/10/i);
    return match ? parseFloat(match[1]) : null;
  };

  // Extract verdict (format: "One line verdict:\n...")
  const getVerdict = () => {
    if (!feedback) return '';
    const match = feedback.match(/One\s*line\s*verdict:?\n*([\s\S]*)/i);
    return match ? match[1].trim() : '';
  };

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const element = document.createElement("a");
    const file = new Blob([report], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const validateApiKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsValidatingKey(true);
    setKeyValidationError('');
    setIsKeyValid(false);
    localStorage.removeItem('mistral_api_key_valid');

    try {
      const response = await fetch('http://localhost:8000/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Server validation failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.valid) {
        setIsKeyValid(true);
        localStorage.setItem('mistral_api_key', apiKey.trim());
        localStorage.setItem('mistral_api_key_valid', 'true');
        setShowSettings(false); // Auto collapse settings once validated
      } else {
        setKeyValidationError(data.error || 'The API key provided is invalid. Please try another one.');
      }
    } catch (err) {
      setKeyValidationError(err.message || 'Unable to contact the validation server.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleRemoveKey = () => {
    setApiKey('');
    setIsKeyValid(false);
    localStorage.removeItem('mistral_api_key');
    localStorage.removeItem('mistral_api_key_valid');
    setShowSettings(true);
  };

  const startResearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (!isKeyValid) {
      setError('Please provide and validate your Mistral API key before initiating research.');
      setShowSettings(true);
      return;
    }

    // Reset states
    setIsRunning(true);
    setCurrentStep(1);
    setError('');
    setSearchResults('');
    setScrapedContent('');
    setReport('');
    setFeedback('');
    setActiveTab('report');
    setStepMessages({
      1: 'Search agent initializing...',
      2: 'Waiting...',
      3: 'Waiting...',
      4: 'Waiting...'
    });

    try {
      const response = await fetch('http://localhost:8000/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, apiKey }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save the last partial line back to the buffer
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === 'status') {
                setCurrentStep(event.step);
                setStepMessages(prev => {
                  const updated = { ...prev };
                  updated[event.step] = event.message;
                  // Mark previous steps as completed
                  for (let i = 1; i < event.step; i++) {
                    updated[i] = 'Completed successfully';
                  }
                  return updated;
                });
              } else if (event.type === 'search_results') {
                setSearchResults(ensureString(event.data));
                setActiveTab('search');
              } else if (event.type === 'scraped_content') {
                setScrapedContent(ensureString(event.data));
                setActiveTab('scrape');
              } else if (event.type === 'report') {
                setReport(ensureString(event.data));
                setActiveTab('report');
              } else if (event.type === 'feedback') {
                setFeedback(ensureString(event.data));
                setActiveTab('critic');
              } else if (event.type === 'complete') {
                setCurrentStep(5);
                setStepMessages({
                  1: 'Completed successfully',
                  2: 'Completed successfully',
                  3: 'Completed successfully',
                  4: 'Completed successfully'
                });
                setIsRunning(false);
              } else if (event.type === 'error') {
                setError(event.message);
                setIsRunning(false);
              }
            } catch (err) {
              console.error('Failed to parse SSE data:', err);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'A network error occurred. Is the backend running?');
      setIsRunning(false);
    }
  };

  // Basic HTML markdown formatter for premium output rendering
  const formatReportHTML = (text) => {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');

    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Bullet points (convert starting with - or * or numbers)
    html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^\s*(\d+\.)\s+(.*?)$/gm, '<li><span class="step-num">$1</span> $2</li>');

    // Checkmarks
    html = html.replace(/✅/g, '<span class="check-icon">✓</span>');

    // Line breaks and paragraph wrappers
    html = html.replace(/\n\n/g, '<p></p>');

    return html;
  };

  const parsedScore = getScore();
  const verdictText = getVerdict();

  return (
    <div className="app-container">
      {/* Header section */}
      <header className="header">
        <div className="brand">
          <div className="logo-icon">
            <Compass className="spin-slow" size={26} />
          </div>
          <div className="logo-text">
            <h1>ResearchOS</h1>
            <p>Multi-Agent Collaborative Scientific Analysis Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className={`action-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            disabled={isRunning}
          >
            <Settings size={16} />
            API Credentials
          </button>
          <div className="status-pill">
            <div className={`status-dot ${isRunning ? 'active' : ''}`}></div>
            {isRunning ? 'Agents Synchronizing' : 'Core Engine Ready'}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left column: Controls & Visual flow */}
        <div className="flex flex-col gap-6">
          
          {/* Collapsible API Key Card */}
          {showSettings && (
            <div className="glass-card active-card settings-card">
              <h3 className="card-title">
                <Key size={18} />
                Mistral AI Credentials
              </h3>
              <p className="text-xs text-muted mb-6">
                To run the multi-agent pipelines, configure a valid Mistral AI API key below. 
                Your key is stored securely in your local browser session.
              </p>
              
              <form onSubmit={validateApiKey} className="flex flex-col gap-4">
                <div className="key-input-group">
                  <div className="key-input-wrapper">
                    <input 
                      type={showKey ? 'text' : 'password'}
                      placeholder="Enter mistral_api_key..."
                      className="search-input"
                      style={{ paddingRight: '48px', fontSize: '13px' }}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={isValidatingKey || isRunning}
                    />
                    <button 
                      type="button" 
                      className="key-toggle-btn"
                      onClick={() => setShowKey(!showKey)}
                      disabled={!apiKey}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {isKeyValid ? (
                    <button 
                      type="button" 
                      onClick={handleRemoveKey}
                      className="validate-btn" 
                      style={{ background: 'hsla(var(--error), 0.15)', border: '1px solid hsla(var(--error), 0.3)', color: 'hsl(var(--error))' }}
                      disabled={isRunning}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      type="submit" 
                      className="validate-btn"
                      disabled={isValidatingKey || !apiKey.trim() || isRunning}
                    >
                      {isValidatingKey ? (
                        <>
                          <RotateCw className="animate-spin" size={14} />
                          Verifying...
                        </>
                      ) : (
                        'Verify Key'
                      )}
                    </button>
                  )}
                </div>
              </form>

              {keyValidationError && (
                <div className="flex items-start gap-2 p-3 mt-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{keyValidationError}</span>
                </div>
              )}

              <div className={`key-status-badge ${isKeyValid ? 'valid' : apiKey ? 'invalid' : 'idle'}`}>
                {isKeyValid ? (
                  <>
                    <ShieldCheck size={14} />
                    Validated & Session Active
                  </>
                ) : apiKey ? (
                  <>
                    <Lock size={14} />
                    Unverified Credentials
                  </>
                ) : (
                  <>
                    <Info size={14} />
                    Awaiting API Key Setup
                  </>
                )}
              </div>
            </div>
          )}

          {/* Director Card */}
          <div className="glass-card">
            <h3 className="card-title">
              <Terminal size={18} />
              Research Director
            </h3>
            
            <form onSubmit={startResearch} className="search-form">
              <div className="input-wrapper">
                <input 
                  type="text"
                  placeholder="Enter a deep research topic..."
                  className="search-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isRunning || !isKeyValid}
                />
              </div>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isRunning || !topic.trim() || !isKeyValid}
              >
                {isRunning ? (
                  <>
                    <RotateCw className="animate-spin" size={18} />
                    Running Agents...
                  </>
                ) : (
                  <>
                    Initialize Pipeline
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {!isKeyValid && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm">
                <Info className="shrink-0 mt-0.5" size={16} />
                <span>Configure and validate your Mistral API Key above to unlock the Research Director.</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Agent progress timeline */}
            <div className="agent-flow">
              {/* Step 1: Search Agent */}
              <div className={`agent-step ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                <div className="agent-node">
                  {currentStep > 1 ? <CheckCircle2 size={14} /> : <Search size={14} />}
                </div>
                <div className="agent-info">
                  <span className="agent-name">Search Agent</span>
                  <span className="agent-description">{stepMessages[1]}</span>
                </div>
              </div>

              {/* Step 2: Reader Scraper */}
              <div className={`agent-step ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                <div className="agent-node">
                  {currentStep > 2 ? <CheckCircle2 size={14} /> : <Compass size={14} />}
                </div>
                <div className="agent-info">
                  <span className="agent-name">Web Scraper Agent</span>
                  <span className="agent-description">{stepMessages[2]}</span>
                </div>
              </div>

              {/* Step 3: Writer Chain */}
              <div className={`agent-step ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
                <div className="agent-node">
                  {currentStep > 3 ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                </div>
                <div className="agent-info">
                  <span className="agent-name">Writer Specialist</span>
                  <span className="agent-description">{stepMessages[3]}</span>
                </div>
              </div>

              {/* Step 4: Critic Chain */}
              <div className={`agent-step ${currentStep === 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
                <div className="agent-node">
                  {currentStep > 4 ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                </div>
                <div className="agent-info">
                  <span className="agent-name">Peer Review Critic</span>
                  <span className="agent-description">{stepMessages[4]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Tabs & Display panels */}
        <div className="glass-card">
          {!searchResults && !report && !isRunning ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Cpu className="spin-slow" size={32} />
              </div>
              <h3>Collaborative Agentic Core</h3>
              <p className="mb-6">
                Welcome to ResearchOS. Once your API key is validated, submit a topic and our multi-agent core will activate.
              </p>
              
              <div className="flex flex-col gap-3 text-left w-full max-w-md mx-auto" style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))' }}>
                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/5">
                  <Search size={16} className="text-cyan-400 shrink-0" />
                  <span><strong>Search Agent</strong> finds recent, authoritative web sources using Tavily.</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/5">
                  <Compass size={16} className="text-emerald-400 shrink-0" />
                  <span><strong>Scraper Agent</strong> extracts clean, relevant text content out of target URLs.</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/5">
                  <BookOpen size={16} className="text-purple-400 shrink-0" />
                  <span><strong>Writer Specialist</strong> organizes discoveries into an exhaustive structured report.</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/5">
                  <FileText size={16} className="text-pink-400 shrink-0" />
                  <span><strong>Critic Critic</strong> evaluates the report, calculating a rating out of 10.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="tabs-container">
              {/* Tab selector buttons */}
              <div className="tabs-header">
                {searchResults && (
                  <button 
                    onClick={() => setActiveTab('search')}
                    className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
                  >
                    <Search size={16} />
                    Search Discoveries
                  </button>
                )}
                {scrapedContent && (
                  <button 
                    onClick={() => setActiveTab('scrape')}
                    className={`tab-btn ${activeTab === 'scrape' ? 'active' : ''}`}
                  >
                    <Compass size={16} />
                    Scraped Context
                  </button>
                )}
                {report && (
                  <button 
                    onClick={() => setActiveTab('report')}
                    className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                  >
                    <BookOpen size={16} />
                    Research Report
                  </button>
                )}
                {feedback && (
                  <button 
                    onClick={() => setActiveTab('critic')}
                    className={`tab-btn ${activeTab === 'critic' ? 'active' : ''}`}
                  >
                    <FileText size={16} />
                    Critic Feedback
                  </button>
                )}
              </div>

              {/* Search results tab */}
              {activeTab === 'search' && searchResults && (
                <div className="tab-pane">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                      <Search size={16} className="text-cyan-400" />
                      Synthesized Search Hits
                    </h4>
                  </div>
                  <div className="pre-wrap-box">
                    {searchResults}
                  </div>
                </div>
              )}

              {/* Scraped content tab */}
              {activeTab === 'scrape' && scrapedContent && (
                <div className="tab-pane">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <Compass size={16} className="text-emerald-400" />
                    Deep Scraped Context
                  </h4>
                  <div className="pre-wrap-box">
                    {scrapedContent}
                  </div>
                </div>
              )}

              {/* Research report tab */}
              {activeTab === 'report' && report && (
                <div className="tab-pane">
                  <div className="report-actions">
                    <button onClick={handleCopyReport} className="action-btn">
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handleDownloadReport} className="action-btn">
                      <Download size={16} />
                      Download Markdown
                    </button>
                  </div>
                  <div 
                    className="report-content"
                    dangerouslySetInnerHTML={{ __html: formatReportHTML(report) }}
                  />
                </div>
              )}

              {/* Critic feedback tab */}
              {activeTab === 'critic' && feedback && (
                <div className="tab-pane">
                  <div className="critic-grid">
                    {/* Circle Score dial */}
                    {parsedScore !== null && (
                      <div className="score-card">
                        <span className="text-xs uppercase tracking-wider text-muted font-bold">Critic Score</span>
                        <div className="radial-score-wrapper">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle 
                              cx="50" 
                              cy="50" 
                              r="40" 
                              stroke="hsla(var(--border), 0.5)" 
                              strokeWidth="8" 
                              fill="transparent" 
                            />
                            <circle 
                              cx="50" 
                              cy="50" 
                              r="40" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth="8" 
                              fill="transparent" 
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * (1 - parsedScore / 10)}`}
                              strokeLinecap="round"
                              style={{ transition: 'stroke-dashoffset 1s ease' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="radial-score-value">{parsedScore}</span>
                            <span className="text-xs text-muted mt-2 ml-0.5">/10</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted">Evaluation Complete</span>
                      </div>
                    )}

                    {/* Detailed feedback */}
                    <div className="critic-content">
                      {verdictText && (
                        <div className="critic-verdict">
                          <strong>Verdict: </strong>
                          {verdictText}
                        </div>
                      )}
                      <div className="critic-details-box pre-wrap-box">
                        {feedback}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
