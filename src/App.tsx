import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Music, ArrowRight, Loader2, Link as LinkIcon, AlertCircle, Copy, Check } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [copiedYoutube, setCopiedYoutube] = useState(false);
  const [copiedYtMusic, setCopiedYtMusic] = useState(false);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setCopiedYoutube(false);
    setCopiedYtMusic(false);

    try {
      const response = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        throw new Error('Failed to find the song. Please check the link and try again.');
      }

      const data = await response.json();
      
      const entityId = data.entityUniqueId;
      const entity = data.entitiesByUniqueId[entityId];
      
      const youtubeLink = data.linksByPlatform?.youtube?.url;
      const ytMusicLink = data.linksByPlatform?.youtubeMusic?.url;

      if (!youtubeLink && !ytMusicLink) {
        throw new Error('Could not find a YouTube link for this track.');
      }

      setResult({
        title: entity?.title || 'Unknown Title',
        artist: entity?.artistName || 'Unknown Artist',
        thumbnail: entity?.thumbnailUrl,
        youtube: youtubeLink,
        youtubeMusic: ytMusicLink
      });

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'youtube' | 'ytmusic') => {
    try {
      // Modern approach (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for HTTP environments (like VPS by IP address)
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Make it invisible
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          console.error('Fallback copy failed', error);
        } finally {
          textArea.remove();
        }
      }

      if (type === 'youtube') {
        setCopiedYoutube(true);
        setTimeout(() => setCopiedYoutube(false), 2000);
      } else {
        setCopiedYtMusic(true);
        setTimeout(() => setCopiedYtMusic(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center p-4 font-sans selection:bg-red-500/30">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-2xl mb-2"
          >
            <Youtube className="w-8 h-8 text-red-500" />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            Any Music to <span className="text-red-500">YouTube</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-neutral-400 text-lg max-w-lg mx-auto"
          >
            Paste a link from Spotify, Apple Music, Yandex Music, or any other service to get the YouTube equivalent instantly.
          </motion.p>
        </div>

        {/* Input Form */}
        <motion.form 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onSubmit={handleConvert} 
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all shadow-2xl">
            <div className="pl-4 pr-2 text-neutral-500">
              <LinkIcon className="w-5 h-5" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="flex-1 bg-transparent py-4 px-2 text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              required
            />
            <div className="pr-2">
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="bg-neutral-100 text-neutral-950 hover:bg-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Convert <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.form>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20 mt-4">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative mt-8"
            >
              {/* Background blur of thumbnail */}
              {result.thumbnail && (
                <div 
                  className="absolute inset-0 opacity-10 blur-3xl scale-110 pointer-events-none"
                  style={{
                    backgroundImage: `url(${result.thumbnail})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              )}

              <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start">
                {/* Thumbnail */}
                {result.thumbnail ? (
                  <img 
                    src={result.thumbnail} 
                    alt={result.title} 
                    referrerPolicy="no-referrer"
                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-neutral-800 flex items-center justify-center shadow-lg">
                    <Music className="w-12 h-12 text-neutral-600" />
                  </div>
                )}

                {/* Info & Links */}
                <div className="flex-1 w-full space-y-6 text-center md:text-left">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1 line-clamp-2">{result.title}</h2>
                    <p className="text-neutral-400 text-lg">{result.artist}</p>
                  </div>

                  <div className="space-y-3">
                    {result.youtube && (
                      <div className="flex items-center gap-3">
                        <a 
                          href={result.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center md:justify-start gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 px-4 rounded-xl transition-colors group"
                        >
                          <Youtube className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Open in YouTube</span>
                        </a>
                        <button
                          onClick={() => copyToClipboard(result.youtube, 'youtube')}
                          className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors border border-neutral-700"
                          title="Copy link"
                        >
                          {copiedYoutube ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    )}

                    {result.youtubeMusic && (
                      <div className="flex items-center gap-3">
                        <a 
                          href={result.youtubeMusic}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center md:justify-start gap-3 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 py-3 px-4 rounded-xl transition-colors group"
                        >
                          <Music className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Open in YouTube Music</span>
                        </a>
                        <button
                          onClick={() => copyToClipboard(result.youtubeMusic, 'ytmusic')}
                          className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors border border-neutral-700"
                          title="Copy link"
                        >
                          {copiedYtMusic ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
