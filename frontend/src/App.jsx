import { useState } from 'react';
import axios from 'axios';
import { Link, Copy, CheckCircle2, Activity, ArrowRight, Globe } from 'lucide-react';

function App() {
  const [longUrl, setLongUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setLoading(true);

    try {
      // Backend API ko POST request bhej rahe hain
      const response = await axios.post('http://localhost:8000/url', { url: longUrl });
      setShortUrl(`http://localhost:8000/${response.data.id}`);
    } catch (err) {
      setError('Connection failed. Backend server check karein.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Glowing Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl text-center space-y-8">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <Activity size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Project 3.O UI Live</span>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Shortify <span className="text-blue-500">URL</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Apne lambe URLs ko ek click mein chota aur trackable banayein.
          </p>
        </div>

        {/* Glassmorphism Input Form */}
        <div className="bg-white/5 border border-white/10 p-2 rounded-2xl backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 flex items-center">
              <Globe className="absolute left-4 text-slate-400" size={20} />
              <input
                type="url"
                required
                value={longUrl}
                onChange={(e) => setLongUrl(e.target.value)}
                placeholder="https://example.com/very-long-url..."
                className="w-full pl-12 pr-4 py-4 bg-transparent outline-none text-white placeholder:text-slate-500 text-base"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Shorten'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        {error && <p className="text-red-400 font-medium">{error}</p>}

        {/* Result Card */}
        {shortUrl && (
          <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
            <div className="text-left overflow-hidden w-full">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Aapka Short Link:</p>
              <a 
                href={shortUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-lg text-blue-300 font-medium hover:underline truncate block"
              >
                {shortUrl}
              </a>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${
                copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
              }`}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;