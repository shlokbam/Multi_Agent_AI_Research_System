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
  Download
} from 'lucide-react';
import './App.css';

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
  
  const progressInterval = useRef(null);

  // Extract score out of critic feedback (format: "Score: X/10")
  const getScore = () => {
    if (!feedback) return null;
    const match = feedback.match(/Score:\s*(\d+)\/10/i);
    return match ? parseInt(match[1]) : null;
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

  const startResearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

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
        body: JSON.stringify({ topic }),
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
                setSearchResults(event.data);
                setActiveTab('search');
              } else if (event.type === 'scraped_content') {
                setScrapedContent(event.data);
                setActiveTab('scrape');
              } else if (event.type === 'report') {
                setReport(event.data);
                setActiveTab('report');
              } else if (event.type === 'feedback') {
                setFeedback(event.data);
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
        <div className="status-pill">
          <div className={`status-dot ${isRunning ? 'active' : ''}`}></div>
          {isRunning ? 'Agents Synchronizing' : 'Core Engine Ready'}
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left column: Controls & Visual flow */}
        <div className="flex flex-col gap-6">
          <div className="glass-card active-card">
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
                  disabled={isRunning}
                />
              </div>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isRunning || !topic.trim()}
              >
                {isRunning ? (
                  <>
                    <RotateCw className="animate-spin" size={18} />
                    Researching...
                  </>
                ) : (
                  <>
                    Initialize Pipeline
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

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
                <Compass size={32} />
              </div>
              <h3>Launch a New Investigation</h3>
              <p>
                Provide a complex question, scientific concept or market trend. 
                Our multi-agent team will crawl the web, scrape articles, write an exhaustive report, 
                and perform critique analysis.
              </p>
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
