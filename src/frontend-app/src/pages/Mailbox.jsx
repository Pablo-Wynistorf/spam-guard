import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SpotlightCard from '../components/SpotlightCard';
import SplitText from '../components/SplitText';
import PulseDot from '../components/PulseDot';
import { useToast } from '../components/Toast';

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseJwt(token) {
  try {
    const [, b64] = token.split('.');
    const base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const RefreshIcon = ({ spinning }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform ${spinning ? 'animate-spin' : ''}`}>
    <path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
  </svg>
);

const Mailbox = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState([]);
  const [selectedHtml, setSelectedHtml] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [countdown, setCountdown] = useState(10);
  const [copied, setCopied] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'preview'
  const countdownRef = useRef(10);
  const autoCopied = useRef(false);

  // Parse email from JWT and auto-copy on first load
  useEffect(() => {
    const jwt = getCookie('email_session');
    const payload = parseJwt(jwt);
    if (payload?.email) {
      setEmail(payload.email);
      if (!autoCopied.current) {
        autoCopied.current = true;
        navigator.clipboard.writeText(payload.email).then(() => {
          toast('Email copied to clipboard', 'success');
        }).catch(() => {});
      }
    } else {
      navigate('/');
    }
  }, [navigate, toast]);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/fetch-emails', { credentials: 'include' });
      if (res.status === 401) {
        document.cookie = 'email_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setEmails(Array.isArray(data.emails) ? data.emails : []);
    } catch {
      setEmails([]);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        fetchEmails();
        countdownRef.current = 10;
        setCountdown(10);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const manualRefresh = () => {
    setSpinning(true);
    countdownRef.current = 10;
    setCountdown(10);
    fetchEmails();
    setTimeout(() => setSpinning(false), 900);
  };

  const copyEmail = () => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    toast('Email copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteEmail = () => {
    document.cookie = 'email_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    navigate('/');
  };

  const loadEmailContent = async (s3Key, idx) => {
    setLoadingEmail(true);
    setSelectedIdx(idx);
    setMobileView('preview');
    try {
      const res = await fetch(`/${s3Key}`);
      if (!res.ok) throw new Error('Failed');
      setSelectedHtml(await res.text());
    } catch {
      setSelectedHtml('<p style="color:#ef4444;padding:20px;font-family:sans-serif">Error loading email.</p>');
    } finally {
      setLoadingEmail(false);
    }
  };

  const goBackToList = () => {
    setMobileView('list');
    setSelectedHtml('');
    setSelectedIdx(-1);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SplitText
              text="Spam Guard"
              className="text-lg sm:text-xl font-bold text-white flex shrink-0"
              delay={40}
              rootMargin="0px"
              threshold={0}
            />
            <div className="hidden sm:block h-6 w-px bg-gray-700" />
            <div className="hidden sm:flex items-center gap-2 min-w-0 bg-gray-900 rounded-lg px-3 py-1.5 border border-gray-800">
              <span className="text-sm text-gray-300 truncate font-mono">{email}</span>
              <button
                onClick={copyEmail}
                className="cursor-pointer shrink-0 text-gray-400 hover:text-white transition-colors"
                aria-label="Copy email"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile copy button */}
            <button
              onClick={copyEmail}
              className="sm:hidden cursor-pointer flex items-center gap-1.5 rounded-lg bg-gray-900 border border-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className="font-mono truncate max-w-[120px]">{email}</span>
            </button>
            <button
              onClick={deleteEmail}
              className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <TrashIcon />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} sm:flex w-full sm:w-80 lg:w-96 flex-col border-r border-gray-800 bg-gray-950`}>
          {/* Inbox header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Inbox</h2>
              {emails.length > 0 && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  {emails.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PulseDot color="bg-emerald-400" />
              <button
                onClick={manualRefresh}
                className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 transition-all"
                aria-label="Refresh inbox"
              >
                <RefreshIcon spinning={spinning} />
              </button>
              <span className="text-xs text-gray-600 tabular-nums font-mono w-6 text-right">{countdown}s</span>
            </div>
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                  <MailIcon />
                </div>
                <p className="text-sm text-gray-500">No emails yet</p>
                <p className="text-xs text-gray-600 mt-1">Emails will appear here automatically</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {emails.map((em, i) => (
                  <button
                    key={i}
                    onClick={() => loadEmailContent(em.s3Key, i)}
                    className={`cursor-pointer w-full text-left rounded-xl p-3 transition-all duration-150 group ${
                      selectedIdx === i
                        ? 'bg-blue-500/10 border border-blue-500/30'
                        : 'hover:bg-gray-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${
                        selectedIdx === i ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500 group-hover:text-gray-400'
                      }`}>
                        <MailIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          selectedIdx === i ? 'text-white' : 'text-gray-200'
                        }`}>
                          {em.subject || '(no subject)'}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{em.sender}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(em.date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Preview pane */}
        <main className={`${mobileView === 'preview' ? 'flex' : 'hidden'} sm:flex flex-1 flex-col bg-gray-900 min-w-0`}>
          {/* Mobile back button */}
          {mobileView === 'preview' && (
            <div className="sm:hidden shrink-0 border-b border-gray-800 px-3 py-2">
              <button
                onClick={goBackToList}
                className="cursor-pointer flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <BackIcon />
                Back to inbox
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {loadingEmail ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading email...</span>
                </div>
              </div>
            ) : selectedHtml ? (
              <iframe
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                style={{ backgroundColor: 'white' }}
                srcDoc={selectedHtml}
                title="Email content"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <SpotlightCard className="max-w-xs" spotlightColor="rgba(59, 130, 246, 0.08)">
                  <div className="flex flex-col items-center py-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-3 text-gray-600">
                      <MailIcon />
                    </div>
                    <p className="text-sm text-gray-400">Select an email to read</p>
                    <p className="text-xs text-gray-600 mt-1">Choose from your inbox on the left</p>
                  </div>
                </SpotlightCard>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Mailbox;
