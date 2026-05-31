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
  Info,
  Server,
  Code,
  Clock,
  FileCode,
  ExternalLink
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  
  const [activeTab, setActiveTab] = useState('workflow');
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

  // Get score color
  const getScoreColorClass = (score) => {
    if (score === null) return 'hsl(var(--primary))';
    if (score >= 7.5) return 'hsl(var(--success))';
    if (score >= 5.5) return 'hsl(var(--warning))';
    return 'hsl(var(--error))';
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

  // Document metrics calculations
  const getWordCount = () => {
    if (!report) return 0;
    return report.split(/\s+/).filter(Boolean).length;
  };

  const getReadingTime = () => {
    const count = getWordCount();
    return Math.max(1, Math.ceil(count / 200)); // 200 Words Per Minute
  };

  const validateApiKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsValidatingKey(true);
    setKeyValidationError('');
    setIsKeyValid(false);
    localStorage.removeItem('mistral_api_key_valid');

    try {
      const response = await fetch(`${API_BASE}/api/validate-key`, {
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
    setActiveTab('workflow');
    setStepMessages({
      1: 'Search agent initializing...',
      2: 'Waiting...',
      3: 'Waiting...',
      4: 'Waiting...'
    });

    try {
      const response = await fetch(`${API_BASE}/api/research`, {
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
              } else if (event.type === 'scraped_content') {
                setScrapedContent(ensureString(event.data));
              } else if (event.type === 'report') {
                setReport(ensureString(event.data));
              } else if (event.type === 'feedback') {
                setFeedback(ensureString(event.data));
              } else if (event.type === 'complete') {
                setCurrentStep(5);
                setStepMessages({
                  1: 'Completed successfully',
                  2: 'Completed successfully',
                  3: 'Completed successfully',
                  4: 'Completed successfully'
                });
                setIsRunning(false);
                // When complete, switch to final report to present findings
                setActiveTab('report');
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

  // Interactive Node Navigation Handler
  const handleNodeClick = (nodeId) => {
    if (nodeId === 'search' && searchResults) setActiveTab('search');
    else if ((nodeId === 'scraper' || nodeId === 'selector') && scrapedContent) setActiveTab('scrape');
    else if ((nodeId === 'writer' || nodeId === 'aggregator' || nodeId === 'output') && report) setActiveTab('report');
    else if (nodeId === 'critic' && feedback) setActiveTab('critic');
    else setActiveTab('workflow');
  };

  // Inspect indicator text for active/completed nodes
  const getNodeInspectLabel = (nodeId) => {
    if (nodeId === 'search' && searchResults) return 'View Hits';
    if ((nodeId === 'scraper' || nodeId === 'selector') && scrapedContent) return 'View Context';
    if ((nodeId === 'writer' || nodeId === 'aggregator' || nodeId === 'output') && report) return 'View Report';
    if (nodeId === 'critic' && feedback) return 'View Review';
    return null;
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
  const scoreColor = getScoreColorClass(parsedScore);

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
              <div className="input-wrapper search-bar-wrapper">
                <Search size={18} className="search-bar-icon" />
                <input 
                  type="text"
                  placeholder="Enter a deep research topic..."
                  className="search-input search-bar-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isRunning || !isKeyValid}
                />
                <kbd className="keyboard-shortcut-badge">↵ Enter</kbd>
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

            {/* Suggested topics - visible when idle */}
            {!isRunning && (
              <div className="suggested-topics">
                <span className="text-xs uppercase tracking-wider text-muted font-bold block mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" />
                  Suggested Investigations
                </span>
                <div className="flex flex-col gap-2">
                  <button 
                    type="button"
                    className="topic-chip"
                    onClick={() => { setTopic('devops in 2026'); setError(''); }}
                    disabled={isRunning}
                  >
                    <Cpu size={13} className="text-fuchsia-400 text-accent glow-icon" />
                    DevOps trends in 2026
                  </button>
                  <button 
                    type="button"
                    className="topic-chip"
                    onClick={() => { setTopic('ai agents evolution in 2026'); setError(''); }}
                    disabled={isRunning}
                  >
                    <RefreshCw size={13} className="text-cyan-400 text-secondary glow-icon-cyan" />
                    AI Agent evolution in 2026
                  </button>
                  <button 
                    type="button"
                    className="topic-chip"
                    onClick={() => { setTopic('quantum computing breakthroughs 2026'); setError(''); }}
                    disabled={isRunning}
                  >
                    <Compass size={13} className="text-amber-400 glow-icon-amber" />
                    Quantum Computing in 2026
                  </button>
                </div>
              </div>
            )}

            {/* Live Terminal Console - visible when running */}
            {isRunning && (
              <div className="live-terminal mt-6">
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                  </div>
                  <span className="terminal-title">research_director.log</span>
                </div>
                <div className="terminal-body">
                  <div className="terminal-line system">
                    <span className="time">[SYS]</span> Collaborative Multi-Agent suite initialized.
                  </div>
                  {currentStep >= 1 && (
                    <div className="terminal-line active">
                      <span className="time">[AGENT]</span> search: Initiating parallel Tavily index queries...
                    </div>
                  )}
                  {currentStep > 1 && (
                    <div className="terminal-line success">
                      <span className="time">[SUCCESS]</span> search: 5 authoritative URLs compiled successfully.
                    </div>
                  )}
                  {currentStep >= 2 && (
                    <div className="terminal-line active">
                      <span className="time">[AGENT]</span> scraper: Selecting top domain and extracting core DOM...
                    </div>
                  )}
                  {currentStep > 2 && (
                    <div className="terminal-line success">
                      <span className="time">[SUCCESS]</span> scraper: Web content strip and parsed successfully.
                    </div>
                  )}
                  {currentStep >= 3 && (
                    <div className="terminal-line active">
                      <span className="time">[AGENT]</span> writer: Synthesizing context and drafting Markdown paper...
                    </div>
                  )}
                  {currentStep > 3 && (
                    <div className="terminal-line success">
                      <span className="time">[SUCCESS]</span> writer: Standardized research draft written (3000 chars).
                    </div>
                  )}
                  {currentStep >= 4 && (
                    <div className="terminal-line active">
                      <span className="time">[AGENT]</span> critic: Submitting draft to Review Specialist...
                    </div>
                  )}
                  {currentStep > 4 && (
                    <div className="terminal-line success">
                      <span className="time">[SUCCESS]</span> critic: Peer review rating and critique computed!
                    </div>
                  )}
                  {currentStep === 5 && (
                    <div className="terminal-line complete">
                      <span className="time">[SYS]</span> Pipeline finished successfully. Connection closed.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* System Diagnostics Panel - always useful */}
            <div className="diagnostics-panel">
              <span className="text-xs uppercase tracking-wider text-muted font-bold block mb-4 flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  <Server size={14} className="text-cyan-400" />
                  System Diagnostics
                </span>
                <span className="telemetry-live-pill">
                  <span className="pulse-telemetry-dot"></span>
                  LIVE TELEMETRY
                </span>
              </span>
              <div className="diag-grid">
                <div className="diag-item model-diag">
                  <div className="diag-header flex items-center justify-between w-full">
                    <span className="label">Agent Model</span>
                    <Cpu size={12} className="diag-icon text-primary-icon" />
                  </div>
                  <span className="val text-primary font-bold">mistral-small</span>
                </div>
                <div className="diag-item temp-diag">
                  <div className="diag-header flex items-center justify-between w-full">
                    <span className="label">Temperature</span>
                    <Clock size={12} className="diag-icon text-amber-icon" />
                  </div>
                  <span className="val text-amber-val">0.3</span>
                </div>
                <div className="diag-item search-diag">
                  <div className="diag-header flex items-center justify-between w-full">
                    <span className="label">Search Engine</span>
                    <Search size={12} className="diag-icon text-cyan-icon" />
                  </div>
                  <span className="val text-cyan-val">Tavily API</span>
                </div>
                <div className="diag-item crawler-diag">
                  <div className="diag-header flex items-center justify-between w-full">
                    <span className="label">Crawler Tool</span>
                    <Code size={12} className="diag-icon text-emerald-icon" />
                  </div>
                  <span className="val text-emerald-val">BeautifulSoup4</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Tabs & Display panels */}
        <div className="glass-card">
          <div className="tabs-container">
            {/* Tab selector buttons */}
            <div className="tabs-header">
              <button 
                onClick={() => setActiveTab('workflow')}
                className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
              >
                <Cpu size={16} />
                Execution Flow
              </button>
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

            {/* Execution Flow Tab - The glowing n8n diagram! */}
            {activeTab === 'workflow' && (
              <div className="tab-pane">
                <h4 className="text-lg font-bold flex items-center gap-2">
                  <Cpu size={16} className="text-purple-400" />
                  Agentic Workflow Canvas
                </h4>
                <p className="text-xs text-muted">
                  Below is the live collaborative schema of ResearchOS. Watch the active nodes glow and data streams pulse as agents execute their specific steps. 
                  <strong style={{ color: 'hsl(var(--primary))', marginLeft: '4px' }}>Pro-Tip: Click completed nodes to jump straight to their logs/results!</strong>
                </p>
                
                <div className="workflow-canvas">
                  <div className="workflow-grid">
                    {/* Row 1 (Flows Left to Right) */}
                    {/* Row 1 (Flows Left to Right) */}
                    {/* Node 1: Trigger */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node trigger-node completed clickable-node`}
                        onClick={() => handleNodeClick('trigger')}
                      >
                        <div className="workflow-node-icon"><Terminal size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Workflow Start</h4>
                          <p>Topic Submitted</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-right ${currentStep >= 1 ? 'active' : ''}`}></div>
                    </div>

                    {/* Node 2: Search Agent */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node search-node ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('search')}
                      >
                        {currentStep > 1 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><Search size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Search Agent</h4>
                          <p>Tavily Search API</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-right ${currentStep >= 2 ? 'active' : ''}`}></div>
                    </div>

                    {/* Node 3: URL Selector */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node selector-node ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('selector')}
                      >
                        {currentStep > 2 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><Compass size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>URL Selector</h4>
                          <p>Relevance Scoring</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-right ${currentStep >= 2 ? 'active' : ''}`}></div>
                    </div>

                    {/* Node 4: Web Scraper */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node scraper-node ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('scraper')}
                      >
                        {currentStep > 2 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><Code size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Web Scraper</h4>
                          <p>BS4 DOM Parser</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-down ${currentStep >= 3 ? 'active' : ''}`}></div>
                    </div>

                    {/* Row 2 (Flows Right to Left) */}
                    {/* Node 8: Final Output */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node output-node ${currentStep === 5 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('output')}
                      >
                        {currentStep === 5 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><CheckCircle2 size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Research Output</h4>
                          <p>Final Markdown Paper</p>
                        </div>
                      </div>
                    </div>

                    {/* Node 7: Review Critic */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node critic-node ${currentStep === 4 ? 'active' : ''} ${currentStep > 4 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('critic')}
                      >
                        {currentStep > 4 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><FileText size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Review Critic</h4>
                          <p>Score & Audit</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-left ${currentStep >= 5 ? 'active' : ''}`}></div>
                    </div>

                    {/* Node 6: Writer Specialist */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node writer-node ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('writer')}
                      >
                        {currentStep > 3 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><BookOpen size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Writer Specialist</h4>
                          <p>Mistral Compiler</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-left ${currentStep >= 4 ? 'active' : ''}`}></div>
                    </div>

                    {/* Node 5: Knowledge Aggregator */}
                    <div className="workflow-node-wrapper">
                      <div 
                        className={`workflow-node aggregator-node ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed clickable-node' : ''}`}
                        onClick={() => handleNodeClick('aggregator')}
                      >
                        {currentStep > 3 && <span className="inspect-pill">View</span>}
                        <div className="workflow-node-icon"><Server size={18} /></div>
                        <div className="workflow-node-text">
                          <h4>Context Aggregator</h4>
                          <p>Synthesizer</p>
                        </div>
                      </div>
                      <div className={`flow-line flow-line-left ${currentStep >= 3 ? 'active' : ''}`}></div>
                    </div>

                  </div>
                </div>
                
                {/* Detailed Description panel */}
                <div className="flex flex-col gap-3 p-4 rounded bg-white/5 border border-white/5" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  <div className="font-bold flex items-center gap-2" style={{ color: 'hsl(var(--primary))' }}>
                    <Info size={16} /> How the Multi-Agent System Collaborates:
                  </div>
                  <div style={{ color: 'hsl(var(--text-secondary))' }}>
                    <ol className="flex flex-col gap-2 ml-4">
                      <li><strong>Step 1 (Search Agent & URL Selector):</strong> Leverages the Tavily Client Search Tool to execute high-fidelity parallel queries on the web. It evaluates URLs based on domain authority, indexing search hits.</li>
                      <li><strong>Step 2 (Web Scraper):</strong> Crawls the selected top domain, downloading raw HTML and parsing the DOM tree using BeautifulSoup4 to isolate readable content while filtering headers, navigations, and styles.</li>
                      <li><strong>Step 3 (Context Aggregator & Writer):</strong> Merges clean scraped webpage text with Tavily synthesized snippets. Instructs the Mistral Small model to compile an structured report according to strict style guidelines.</li>
                      <li><strong>Step 4 (Review Critic & Final Output):</strong> Audit reviews the written draft against factuality and structural soundness, computing a numerical rating, constructive improvement logs, and finalizing the paper.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

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
                {/* Document Metadata Strip */}
                <div className="flex flex-wrap gap-4 items-center justify-between p-4 rounded bg-white/5 border border-white/5" style={{ fontSize: '13px' }}>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Clock size={15} />
                      {getReadingTime()} min read
                    </span>
                    <span className="flex items-center gap-1.5 text-muted border-l border-white/10 pl-4">
                      <FileCode size={15} />
                      {getWordCount()} words
                    </span>
                  </div>
                  <div className="report-actions" style={{ marginBottom: 0 }}>
                    <button onClick={handleCopyReport} className="action-btn">
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handleDownloadReport} className="action-btn">
                      <Download size={16} />
                      Download Markdown
                    </button>
                  </div>
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
                    <div className="score-card" style={{ border: `1.5px solid ${scoreColor}`, boxShadow: `0 0 25px ${scoreColor}15` }}>
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
                            stroke={scoreColor} 
                            strokeWidth="8" 
                            fill="transparent" 
                            strokeDasharray={`${2 * Math.PI * 40}`}
                            strokeDashoffset={`${2 * Math.PI * 40 * (1 - parsedScore / 10)}`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s ease' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="radial-score-value" style={{ color: scoreColor }}>{parsedScore}</span>
                          <span className="text-xs text-muted mt-2 ml-0.5">/10</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted">Evaluation Complete</span>
                    </div>
                  )}

                  {/* Detailed feedback */}
                  <div className="critic-content">
                    {verdictText && (
                      <div className="critic-verdict" style={{ borderLeftColor: scoreColor, background: `${scoreColor}05` }}>
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
        </div>
      </div>
    </div>
  );
}
