import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Play, Send, LogOut, Loader2, CheckCircle2, XCircle, Timer, Share2, Globe, Search, Shield, Info } from 'lucide-react';
import { cn } from './lib/utils';
import { generateFootballQuestion, scoutPlayer, type Question, type PlayerInfo } from './services/gemini';

type GameStatus = 'lobby' | 'playing' | 'finished';
type View = 'game' | 'world' | 'scout';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface GlobalScore {
  name: string;
  score: number;
}

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<GameStatus>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [activeView, setActiveView] = useState<View>('game');
  
  // World Rankings
  const [globalScores, setGlobalScores] = useState<GlobalScore[]>([]);
  const [isLoadingWorld, setIsLoadingWorld] = useState(false);

  // Scouting
  const [scoutQuery, setScoutQuery] = useState('');
  const [scoutResult, setScoutResult] = useState<PlayerInfo | null>(null);
  const [isScouting, setIsScouting] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback((rid: string, name: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId: rid,
        playerName: name
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'ROOM_UPDATE':
          setPlayers(data.players);
          setStatus(data.status);
          break;
        case 'GAME_STARTED':
          setStatus('playing');
          fetchNewQuestion();
          break;
        case 'QUESTION_UPDATE':
          setCurrentQuestion(data.question);
          setSelectedAnswer(null);
          setIsCorrect(null);
          setTimeLeft(15);
          setIsLoadingQuestion(false);
          startTimer();
          break;
      }
    };

    socketRef.current = socket;
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (timeLeft === 0 && status === 'playing' && !selectedAnswer) {
      handleAnswer('TIMEOUT');
    }
  }, [timeLeft, status, selectedAnswer]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName && roomId) {
      setIsJoined(true);
      connectWebSocket(roomId, playerName);
    }
  };

  const handleStartGame = () => {
    socketRef.current?.send(JSON.stringify({ type: 'START_GAME' }));
  };

  const fetchNewQuestion = async () => {
    setIsLoadingQuestion(true);
    try {
      const question = await generateFootballQuestion();
      socketRef.current?.send(JSON.stringify({
        type: 'NEW_QUESTION',
        question
      }));
    } catch (error) {
      console.error('Failed to fetch question:', error);
      setIsLoadingQuestion(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (selectedAnswer || timeLeft === 0) return;
    
    const correct = answer === currentQuestion?.correctAnswer;
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    
    socketRef.current?.send(JSON.stringify({
      type: 'SUBMIT_ANSWER',
      isCorrect: correct
    }));

    if (players[0]?.name === playerName) {
      setTimeout(() => {
        fetchNewQuestion();
      }, 3000);
    }
  };

  const fetchWorldRankings = async () => {
    setIsLoadingWorld(true);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setGlobalScores(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingWorld(false);
    }
  };

  const handleScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoutQuery) return;
    setIsScouting(true);
    try {
      const result = await scoutPlayer(scoutQuery);
      setScoutResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScouting(false);
    }
  };

  useEffect(() => {
    if (activeView === 'world') {
      fetchWorldRankings();
    }
  }, [activeView]);

  const handleShare = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    alert('Room link copied to clipboard!');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) setRoomId(roomParam);
  }, []);

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#151619] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Trophy className="text-white w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase italic">FootyDuel</h1>
            <p className="text-white/50 text-sm mt-2">Real-time Football Trivia</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold text-white/40 mb-2 ml-1">Your Name</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Messi10"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold text-white/40 mb-2 ml-1">Room ID</label>
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room code"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
            >
              Enter Stadium
              <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="text-emerald-500 w-6 h-6" />
            <span className="font-bold tracking-tighter uppercase italic text-xl">FootyDuel</span>
          </div>
          
          <nav className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/10">
            {[
              { id: 'game', label: 'Match', icon: Play },
              { id: 'world', label: 'World Rankings', icon: Globe },
              { id: 'scout', label: 'Scouting Report', icon: Search }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as View)}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  activeView === tab.id ? "bg-emerald-500 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleShare}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
              title="Share Room"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <div className="h-8 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2 text-sm font-medium text-white/60">
              <Users className="w-4 h-4" />
              <span>{players.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeView === 'game' && (
            <motion.div 
              key="game-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              {/* Leaderboard */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-[#151619] border border-white/10 rounded-2xl p-6">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-6 flex items-center gap-2">
                    <Trophy className="w-3 h-3" /> Room Leaderboard
                  </h2>
                  <div className="space-y-3">
                    {players.sort((a, b) => b.score - a.score).map((player, idx) => (
                      <motion.div 
                        layout
                        key={player.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all",
                          player.name === playerName ? "bg-emerald-500/10 border-emerald-500/50" : "bg-white/5 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-white/30 w-4">{idx + 1}</span>
                          <span className="font-medium">{player.name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">{player.score}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Game Area */}
              <div className="lg:col-span-3">
                {status === 'lobby' ? (
                  <div className="bg-[#151619] border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Users className="text-emerald-500 w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Waiting for Kick-off</h2>
                    <p className="text-white/50 mb-8 max-w-md">
                      Invite your friends to join room <span className="text-white font-mono bg-white/10 px-2 py-1 rounded">{roomId}</span>. 
                    </p>
                    {players[0]?.name === playerName ? (
                      <button 
                        onClick={handleStartGame}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-12 py-4 rounded-xl transition-all shadow-lg flex items-center gap-2"
                      >
                        Start Match
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-white/40 italic">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for host to start...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: "100%" }}
                          animate={{ width: `${(timeLeft / 15) * 100}%` }}
                          className={cn(
                            "h-full transition-colors duration-1000",
                            timeLeft > 5 ? "bg-emerald-500" : "bg-red-500"
                          )}
                        />
                      </div>
                      <div className="flex items-center gap-2 font-mono font-bold text-xl">
                        <Timer className={cn("w-5 h-5", timeLeft <= 5 && "text-red-500 animate-bounce")} />
                        {timeLeft}s
                      </div>
                    </div>

                    <div className="bg-[#151619] border border-white/10 rounded-3xl p-8 md:p-12 min-h-[400px] flex flex-col">
                      {isLoadingQuestion ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                          <p className="text-white/40 italic">Gemini is scouting for the next question...</p>
                        </div>
                      ) : currentQuestion ? (
                        <>
                          <div className="mb-8">
                            <span className="text-xs uppercase tracking-widest font-bold text-emerald-500 mb-4 block">Question</span>
                            <h3 className="text-2xl md:text-3xl font-bold leading-tight">{currentQuestion.text}</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                            {currentQuestion.options.map((option) => {
                              const isSelected = selectedAnswer === option;
                              const isCorrectOption = option === currentQuestion.correctAnswer;
                              const showResult = selectedAnswer !== null || timeLeft === 0;

                              return (
                                <button
                                  key={option}
                                  onClick={() => handleAnswer(option)}
                                  disabled={showResult}
                                  className={cn(
                                    "p-6 rounded-2xl border-2 text-left transition-all relative group overflow-hidden",
                                    !showResult && "bg-white/5 border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5",
                                    showResult && isCorrectOption && "bg-emerald-500/10 border-emerald-500 text-emerald-400",
                                    showResult && isSelected && !isCorrectOption && "bg-red-500/10 border-red-500 text-red-400",
                                    showResult && !isSelected && !isCorrectOption && "opacity-40 border-transparent bg-white/5"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-lg">{option}</span>
                                    {showResult && isCorrectOption && <CheckCircle2 className="w-6 h-6" />}
                                    {showResult && isSelected && !isCorrectOption && <XCircle className="w-6 h-6" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <AnimatePresence>
                            {selectedAnswer && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10"
                              >
                                <p className="text-sm text-white/60 italic">
                                  <span className="font-bold text-white not-italic mr-2">Did you know?</span>
                                  {currentQuestion.explanation}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'world' && (
            <motion.div 
              key="world-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-[#151619] border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">World Rankings</h2>
                    <p className="text-white/40 text-sm">Top players across all stadiums</p>
                  </div>
                  <Globe className="text-emerald-500 w-8 h-8" />
                </div>

                {isLoadingWorld ? (
                  <div className="py-20 flex justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {globalScores.map((score, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                            idx === 0 ? "bg-yellow-500 text-black" : 
                            idx === 1 ? "bg-slate-300 text-black" :
                            idx === 2 ? "bg-amber-600 text-white" : "bg-white/10 text-white/40"
                          )}>
                            {idx + 1}
                          </span>
                          <span className="font-bold">{score.name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 text-lg">{score.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'scout' && (
            <motion.div 
              key="scout-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-[#151619] border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Scouting Report</h2>
                    <p className="text-white/40 text-sm">Get real-time data on any player in the world</p>
                  </div>
                  <Search className="text-emerald-500 w-8 h-8" />
                </div>

                <form onSubmit={handleScout} className="relative mb-8">
                  <input 
                    type="text"
                    value={scoutQuery}
                    onChange={(e) => setScoutQuery(e.target.value)}
                    placeholder="Search player name (e.g. Jude Bellingham)..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg"
                  />
                  <button 
                    type="submit"
                    disabled={isScouting}
                    className="absolute right-2 top-2 bottom-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 rounded-xl transition-all disabled:opacity-50"
                  >
                    {isScouting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Scout"}
                  </button>
                </form>

                <AnimatePresence mode="wait">
                  {scoutResult ? (
                    <motion.div 
                      key="scout-result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                      <div className="md:col-span-1 space-y-6">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">Identity</h4>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-white/40">Name</p>
                              <p className="font-bold text-xl">{scoutResult.name}</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/40">Nationality</p>
                              <p className="font-bold">{scoutResult.nationality}</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/40">Age</p>
                              <p className="font-bold">{scoutResult.age}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-emerald-500 mb-4">Market Value</h4>
                          <p className="text-3xl font-bold text-emerald-400">{scoutResult.marketValue}</p>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-6">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">Technical Profile</h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm text-white/40 flex items-center gap-2"><Shield className="w-3 h-3" /> Club</p>
                              <p className="font-bold text-lg">{scoutResult.club}</p>
                            </div>
                            <div>
                              <p className="text-sm text-white/40 flex items-center gap-2"><Play className="w-3 h-3" /> Position</p>
                              <p className="font-bold text-lg">{scoutResult.position}</p>
                            </div>
                          </div>
                          <div className="mt-6">
                            <p className="text-sm text-white/40 mb-2">Recent Form</p>
                            <p className="text-lg leading-relaxed">{scoutResult.recentForm}</p>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4 flex items-center gap-2">
                            <Info className="w-3 h-3" /> Fun Fact
                          </h4>
                          <p className="italic text-white/80">{scoutResult.funFact}</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : !isScouting && (
                    <div className="py-20 text-center text-white/20">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p>Enter a player's name to see their global scouting report</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-end">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-xs font-mono text-white/40 pointer-events-auto">
            CONNECTED TO STADIUM: {roomId}
          </div>
        </div>
      </footer>
    </div>
  );
}
