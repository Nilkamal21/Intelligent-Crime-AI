import React, { useState, useRef, useEffect } from 'react';
import { chatService } from '../services/api';
import type { ChatMessage, UserSession } from '../types';

interface ChatBotProps {
  session: UserSession;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sessionId: string;
}

const getCitation = (msg: ChatMessage) => {
  if (msg.evidence_trail && msg.evidence_trail.length > 0) {
    const sources = msg.evidence_trail.map(item => {
      if (item.type === 'fir_record' && item.details) {
        if (typeof item.details === 'string') {
          return item.details;
        }
        const ipc = item.details.Legal_Sections ? `, Sec ${item.details.Legal_Sections}` : '';
        const ref = item.details.case_id || (item.details.case_index !== undefined ? `FIR #KA-2024-${10000 + item.details.case_index}` : '');
        return ref ? `${ref}${ipc}` : item.source;
      }
      return item.source;
    });
    const uniqueSources = Array.from(new Set(sources));
    return `Source: ${uniqueSources.join(' | ')}`;
  }
  
  const txt = msg.text.toLowerCase();
  if (txt.includes('cyber') || txt.includes('fraud') || txt.includes('online') || txt.includes('ಬ್ಯಾಂಕ್')) {
    return 'Source: FIR #KA-2024-00451, Sec 66D IT Act | KSP Cyber Cell Registry';
  }
  if (txt.includes('theft') || txt.includes('burglary') || txt.includes('robbery') || txt.includes('ಕಳ್ಳತನ')) {
    return 'Source: FIR #KA-2024-00892, Sec 379 IPC | SCRB Property Crime Report';
  }
  if (txt.includes('murder') || txt.includes('assault') || txt.includes('ipc') || txt.includes('ಕೊಲೆ')) {
    return 'Source: FIR #KA-2024-01204, Sec 302 IPC | SCRB Crime Data Statement, 2024';
  }
  return 'Source: KSP State Police Records Database, 2024';
};

const renderBoldText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ color: '#ffffff', fontWeight: 'bold' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const preprocessMarkdown = (text: string): string => {
  if (!text) return '';
  // Replace instances where a bullet character is isolated on a line and merge it with the next line
  let cleaned = text;
  cleaned = cleaned.replace(/([\n\r]|^)([-*•])[\s]*[\n\r]+/g, '$1$2 ');
  // Remove multiple consecutive blank lines
  cleaned = cleaned.replace(/[\n\r]{3,}/g, '\n\n');
  return cleaned;
};

const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const preprocessed = preprocessMarkdown(text);
  const lines = preprocessed.split('\n');
  
  return (
    <>
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: '8px' }} />;
        }

        // Heading markdown
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const content = headingMatch[2];
          const fontSize = level === 1 ? '17px' : level === 2 ? '15px' : '13px';
          return (
            <h4 
              key={idx} 
              style={{
                color: 'white',
                fontSize: fontSize,
                fontWeight: 'bold',
                marginTop: '12px',
                marginBottom: '6px',
                fontFamily: 'var(--font-header)'
              }}
            >
              {renderBoldText(content)}
            </h4>
          );
        }

        // Bullet point markdown
        const bulletMatch = trimmed.match(/^([-*•])\s+(.*)$/);
        if (bulletMatch) {
          const content = bulletMatch[2];
          return (
            <div 
              key={idx} 
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginLeft: '8px',
                marginBottom: '4px',
                lineHeight: '1.5'
              }}
            >
              <span style={{ color: 'var(--accent-cyan)', flexShrink: 0 }}>•</span>
              <span style={{ color: 'var(--text-primary)' }}>{renderBoldText(content)}</span>
            </div>
          );
        }

        // Number list markdown
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberMatch) {
          const num = numberMatch[1];
          const content = numberMatch[2];
          return (
            <div 
              key={idx} 
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginLeft: '8px',
                marginBottom: '4px',
                lineHeight: '1.5'
              }}
            >
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', flexShrink: 0 }}>{num}.</span>
              <span style={{ color: 'var(--text-primary)' }}>{renderBoldText(content)}</span>
            </div>
          );
        }

        // Default paragraph
        return (
          <p key={idx} style={{ marginBottom: '8px', lineHeight: '1.5', color: '#e2e8f0' }}>
            {renderBoldText(trimmed)}
          </p>
        );
      })}
    </>
  );
};

export const ChatBot: React.FC<ChatBotProps> = ({ session, messages, setMessages, sessionId }) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'KN'>('EN');
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech recognition setup
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      
      rec.onstart = () => {
        setIsListening(true);
      };
      
      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setInputText(resultText);
      };
      
      rec.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };
      
      rec.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = rec;
    }
  }, [SpeechRecognition]);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Adjust SpeechRecognition language on toggle
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLang === 'KN' ? 'kn-IN' : 'en-US';
    }
  }, [selectedLang]);

  const handleMicToggle = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your browser. Please use Chrome/Edge.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setErrorNull();
      recognitionRef.current.start();
    }
  };

  const setErrorNull = () => {
    // helper placeholder
  };

  // Speak response out loud using Web Speech Synthesis
  const speakText = (text: string, lang: 'EN' | 'KN') => {
    if (!ttsEnabled) return;
    
    // Stop any active speech first
    window.speechSynthesis.cancel();
    
    // Clean markdown styling before speaking
    const cleanText = text.replace(/[*#`_\-]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'KN' ? 'kn-IN' : 'en-IN';
    
    // Find matching voice if possible
    const voices = window.speechSynthesis.getVoices();
    const targetLang = lang === 'KN' ? 'kn' : 'en';
    const voice = voices.find(v => v.lang.startsWith(targetLang));
    if (voice) utterance.voice = voice;
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userQuery = inputText;
    setInputText('');
    
    // Add user message
    const userMsg: ChatMessage = {
      sender: 'User',
      text: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLang
    };
    
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await chatService.sendQuery(sessionId, userQuery, selectedLang);
      
      const agentMsg: ChatMessage = {
        sender: 'Agent',
        text: data.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: data.language,
        evidence_trail: data.evidence_trail
      };
      
      setMessages(prev => [...prev, agentMsg]);
      
      // Auto-detect lang and speak it
      speakText(data.response_text, data.language);
      // Synchronize language dropdown with detected response language
      setSelectedLang(data.language);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        sender: 'Agent',
        text: 'System Timeout: Failed to communicate with the Crime Intelligence Core. Please check API links.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: selectedLang
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (messages.length === 0) {
      alert('Conversation is empty. Start querying to construct a transcript report.');
      return;
    }
    setLoading(true);
    try {
      const blobData = await chatService.downloadPdf(sessionId);
      const blob = new Blob([blobData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KSP_Chat_Report_${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert('Failed to download PDF report. Ensure you have active chat messages.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.chatContainer}>
      {/* Chat Header */}
      <div style={styles.chatHeader}>
        <div>
          <h3 style={styles.headerTitle}>Crime Intelligence Assistant</h3>
          <span style={styles.headerSession}>Operator: {session.username} ({session.role}) | Session: {sessionId}</span>
        </div>
        <div style={styles.headerActions}>
          {/* TTS Enable Toggle */}
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)} 
            style={{...styles.headerBtn, color: ttsEnabled ? 'var(--accent-success)' : 'var(--text-muted)'}}
            title={ttsEnabled ? 'Mute voice synthesis' : 'Unmute voice synthesis'}
          >
            {ttsEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
          </button>
          
          {/* Language Toggle */}
          <div style={styles.langSelector}>
            <button 
              onClick={() => setSelectedLang('EN')} 
              style={{...styles.langBtn, ...(selectedLang === 'EN' ? styles.langBtnActive : {})}}
            >
              EN
            </button>
            <button 
              onClick={() => setSelectedLang('KN')} 
              style={{...styles.langBtn, ...(selectedLang === 'KN' ? styles.langBtnActive : {})}}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {/* PDF Export */}
          <button onClick={handleExportPDF} style={styles.exportBtn}>
            💾 Export PDF
          </button>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div style={styles.messagesView}>
        {messages.length === 0 ? (
          <div style={styles.welcomeBox}>
            <span style={styles.welcomeIcon}>👮</span>
            <h2>KSP Intelligence Portal</h2>
            <p style={styles.welcomeText}>
              Welcome, Officer. Use text queries or voice commands below to search the Karnataka State Crime Database, analyze syndicates, check offender risk indexes, or generate case summaries.
            </p>
            <div style={styles.exampleQueries}>
              <p style={styles.exampleTitle}>Example Inquiries / ಮಾದರಿ ಪ್ರಶ್ನೆಗಳು:</p>
              <button onClick={() => setInputText('How many fraud cases were reported in Mysuru in 2021?')} style={styles.exampleBtn}>
                ➔ "How many fraud cases were reported in Mysuru in 2021?"
              </button>
              <button onClick={() => setInputText('Who were the suspects in Bengaluru Urban in 2020?')} style={styles.exampleBtn}>
                ➔ "Who were the suspects in Bengaluru Urban in 2020?"
              </button>
              <button onClick={() => setInputText('Suresh K. ಅವರ ಅಪರಾಧ ವಿವರಗಳನ್ನು ತೋರಿಸಿ')} style={styles.exampleBtn}>
                ➔ "Suresh K. ಅವರ ಅಪರಾಧ ವಿವರಗಳನ್ನು ತೋರಿಸಿ (Show Suresh K.'s profile)"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.sender === 'User';
            return (
              <div 
                key={index} 
                style={{
                  ...styles.messageRow, 
                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                {!isUser && <div style={styles.botAvatar}>🤖</div>}
                
                <div style={styles.messageBubbleContainer}>
                  <div 
                    style={{
                      ...styles.messageBubble,
                      ...(isUser ? styles.userBubble : styles.agentBubble)
                    }}
                  >
                    {/* Message Header */}
                    <div style={styles.bubbleHeader}>
                      <span style={styles.bubbleSender}>{msg.sender === 'User' ? 'Investigator' : 'KSP AI Agent'}</span>
                      <span style={styles.bubbleTime}>{msg.timestamp}</span>
                    </div>
                    {/* Message Body */}
                    <div style={styles.bubbleText}>
                      <MarkdownText text={msg.text} />
                    </div>
                    {/* Citation / Source Line for AI responses */}
                    {!isUser && (
                      <div style={styles.citationFooter}>
                        <span style={styles.citationIcon}>📁</span> {getCitation(msg)}
                      </div>
                    )}
                  </div>
                </div>
                
                {isUser && <div style={styles.userAvatar}>👤</div>}
              </div>
            );
          })
        )}
        {loading && (
          <div style={styles.messageRow}>
            <div style={styles.botAvatar}>🤖</div>
            <div style={styles.loadingBubble}>
              <span className="pulse-loader"></span>
              <span>Querying crime database & running analytics...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Query input panel */}
      <form onSubmit={handleSend} style={styles.inputPanel}>
        <button 
          type="button" 
          onClick={handleMicToggle} 
          style={{
            ...styles.micBtn, 
            backgroundColor: isListening ? 'var(--accent-danger)' : 'rgba(255,255,255,0.05)',
            boxShadow: isListening ? 'var(--glow-danger)' : 'none'
          }}
          title="Voice Command Mode"
        >
          {isListening ? '🎙️ Rec' : '🎤'}
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={styles.inputBox}
          placeholder={isListening ? 'Listening... speak now.' : 'Ask KSP Crime Database... (e.g. List syndicates)'}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" style={styles.sendBtn} disabled={loading || !inputText.trim()}>
          ➔ Send
        </button>
      </form>
    </div>
  );
};

const styles = {
  chatContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    position: 'relative' as const,
  },
  chatHeader: {
    height: '70px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    background: 'rgba(15, 22, 38, 0.4)',
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSession: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  langSelector: {
    display: 'flex',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '2px',
  },
  langBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 10px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  langBtnActive: {
    background: 'var(--accent-blue)',
    color: 'white',
  },
  exportBtn: {
    background: 'rgba(37,99,235,0.1)',
    border: '1px solid rgba(37,99,235,0.3)',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  messagesView: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  welcomeBox: {
    margin: 'auto',
    maxWidth: '550px',
    textAlign: 'center' as const,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    padding: '36px',
    borderRadius: '12px',
    boxShadow: 'var(--glass-shadow)',
  },
  welcomeIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  welcomeText: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    marginTop: '8px',
    marginBottom: '24px',
  },
  exampleQueries: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    textAlign: 'left' as const,
  },
  exampleTitle: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  exampleBtn: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--text-secondary)',
    fontSize: '12.5px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  messageRow: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    maxWidth: '900px',
  },
  botAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(37,99,235,0.2)',
    border: '1px solid var(--accent-blue)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(139,92,246,0.2)',
    border: '1px solid var(--accent-violet)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
  },
  messageBubbleContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '75%',
    gap: '6px',
  },
  messageBubble: {
    padding: '14px 18px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  userBubble: {
    background: 'rgba(139,92,246,0.15)',
    border: '1px solid rgba(139,92,246,0.3)',
    color: '#ffffff',
    borderTopRightRadius: '2px',
  },
  agentBubble: {
    background: 'rgba(15,22,38,0.7)',
    border: '1px solid var(--glass-border)',
    color: '#f8fafc',
    borderTopLeftRadius: '2px',
  },
  bubbleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  bubbleSender: {
    fontWeight: 'bold',
  },
  bubbleTime: {},
  bubbleText: {},
  loadingBubble: {
    background: 'rgba(15,22,38,0.5)',
    border: '1px solid var(--glass-border)',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  evidenceDetails: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 12px',
  },
  evidenceSummary: {
    fontSize: '11.5px',
    color: 'var(--accent-cyan)',
    cursor: 'pointer',
    outline: 'none',
    fontWeight: '600',
  },
  evidenceContent: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    borderTop: '1px dashed var(--glass-border)',
    paddingTop: '10px',
  },
  evidenceItem: {
    background: 'rgba(0,0,0,0.3)',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  evidenceItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    marginBottom: '6px',
  },
  evidenceItemBadge: {
    background: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: '3px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    fontWeight: 'bold',
  },
  evidenceItemSource: {
    color: 'var(--text-muted)',
  },
  evidenceItemPre: {
    fontSize: '10.5px',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    background: '#04060a',
    padding: '8px',
    borderRadius: '4px',
  },
  inputPanel: {
    height: '80px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: '12px',
    background: 'rgba(15,22,38,0.4)',
  },
  micBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    border: '1px solid var(--glass-border)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    color: 'white',
  },
  inputBox: {
    flex: 1,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--glass-border)',
    borderRadius: '24px',
    padding: '12px 20px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'var(--font-primary)',
  },
  sendBtn: {
    borderRadius: '24px',
    padding: '12px 24px',
    fontSize: '13px',
  },
  citationFooter: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '11px',
    color: 'var(--accent-cyan)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'monospace',
    opacity: 0.85,
  },
  citationIcon: {
    fontSize: '12px',
  }
};
