import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { QuizQuestion, QuizSession, Player, AppRole, GameStage } from '../types/quiz';
import { 
  getStoredQuestions, 
  saveStoredQuestions, 
  resetStoredQuestions, 
  getStoredSessionByPin, 
  saveStoredSession, 
  saveRecapRecord, 
  getStoredRecap,
  RecapRecord 
} from '../utils/storage';
import { soundManager } from '../utils/soundEffects';
import { SIMULATED_STUDENTS } from '../data/avatars';

interface QuizContextType {
  role: AppRole;
  setRole: (role: AppRole) => void;
  questions: QuizQuestion[];
  addQuestion: (q: Omit<QuizQuestion, 'id'>) => void;
  updateQuestion: (q: QuizQuestion) => void;
  deleteQuestion: (id: string) => void;
  resetQuestions: () => void;
  
  // Host / Dosen methods
  activeSession: QuizSession | null;
  createSession: (options: {
    title: string;
    questionCount: number;
    timePerQuestion: number;
    selectedCategory?: string;
    shuffleQuestions?: boolean;
  }) => string; // returns PIN
  setGameStage: (stage: GameStage) => void;
  nextQuestion: () => void;
  endGame: () => void;
  addSimulatedStudents: (count?: number) => void;
  kickPlayer: (playerId: string) => void;
  
  // Mahasiswa / Player methods
  currentPlayer: Player | null;
  joinSession: (pin: string, name: string, nim?: string, avatar?: string) => { success: boolean; error?: string };
  submitAnswer: (optionIndex: number, timeSpentSec: number) => void;
  leaveSession: () => void;

  // Sound & Recaps
  isMuted: boolean;
  toggleMute: () => void;
  recaps: RecapRecord[];
  refreshRecaps: () => void;
}

const QuizContext = createContext<QuizContextType | null>(null);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<AppRole>('HOME');
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => getStoredQuestions());
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.getMuted());
  const [recaps, setRecaps] = useState<RecapRecord[]>(() => getStoredRecap());

  const channelRef = useRef<BroadcastChannel | null>(null);
  const botTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Setup BroadcastChannel for cross-tab multi-screen sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('quizmobile_channel');
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SESSION_UPDATED') {
          setActiveSession(payload);
          // If current player is in the session, update current player state too
          if (currentPlayer) {
            const updated = payload.players?.find((p: Player) => p.id === currentPlayer.id);
            if (updated) setCurrentPlayer(updated);
          }
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [currentPlayer]);

  // Broadcast session changes to other tabs
  const broadcastSession = useCallback((session: QuizSession) => {
    saveStoredSession(session);
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'SESSION_UPDATED', payload: session });
      } catch {
        // broadcast fallback silent
      }
    }
  }, []);

  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const refreshRecaps = () => {
    setRecaps(getStoredRecap());
  };

  // Question bank CRUD
  const addQuestion = (newQ: Omit<QuizQuestion, 'id'>) => {
    const id = `flt-custom-${Date.now()}`;
    const questionWithId: QuizQuestion = { ...newQ, id };
    const updated = [questionWithId, ...questions];
    setQuestions(updated);
    saveStoredQuestions(updated);
  };

  const updateQuestion = (updatedQ: QuizQuestion) => {
    const updated = questions.map(q => q.id === updatedQ.id ? updatedQ : q);
    setQuestions(updated);
    saveStoredQuestions(updated);
  };

  const deleteQuestion = (id: string) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    saveStoredQuestions(updated);
  };

  const resetQuestions = () => {
    const defaultQs = resetStoredQuestions();
    setQuestions(defaultQs);
  };

  // Create game session
  const createSession = ({
    title,
    questionCount,
    timePerQuestion,
    selectedCategory,
    shuffleQuestions = true,
  }: {
    title: string;
    questionCount: number;
    timePerQuestion: number;
    selectedCategory?: string;
    shuffleQuestions?: boolean;
  }): string => {
    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    let pool = [...questions];
    if (selectedCategory && selectedCategory !== 'Semua') {
      pool = pool.filter(q => q.category === selectedCategory);
    }
    if (pool.length === 0) pool = [...questions];

    if (shuffleQuestions) {
      pool.sort(() => Math.random() - 0.5);
    }

    const selectedIds = pool.slice(0, Math.min(questionCount, pool.length)).map(q => q.id);

    const newSession: QuizSession = {
      pin,
      title: title || 'UAS Pemrograman Web 2 (Kahoot Style)',
      createdAt: Date.now(),
      status: 'WAITING',
      questionIds: selectedIds,
      currentQuestionIndex: 0,
      timePerQuestion: timePerQuestion || 20,
      stage: 'LOBBY',
      stageStartTime: Date.now(),
      players: [],
      showExplanation: true,
      shuffleQuestions: !!shuffleQuestions,
    };

    setActiveSession(newSession);
    broadcastSession(newSession);
    return pin;
  };

  // Add simulated classmates to make demo lively
  const addSimulatedStudents = (count: number = 6) => {
    if (!activeSession) return;
    const available = SIMULATED_STUDENTS.filter(
      b => !activeSession.players.some(p => p.name === b.name)
    );
    const toAdd = available.slice(0, count);

    const newBots: Player[] = toAdd.map(b => ({
      id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: b.name,
      nim: b.nim,
      avatar: b.avatar,
      isBot: true,
      score: 0,
      streak: 0,
      answers: [],
    }));

    const updatedSession: QuizSession = {
      ...activeSession,
      players: [...activeSession.players, ...newBots],
    };

    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  // Remove player from session
  const kickPlayer = (playerId: string) => {
    if (!activeSession) return;
    const updatedSession: QuizSession = {
      ...activeSession,
      players: activeSession.players.filter(p => p.id !== playerId),
    };
    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  // Trigger bots to answer during QUESTION stage
  const simulateBotAnswers = useCallback((session: QuizSession) => {
    // Clear any previous bot timers
    botTimersRef.current.forEach(t => clearTimeout(t));
    botTimersRef.current = [];

    const currentQId = session.questionIds[session.currentQuestionIndex];
    const currentQ = questions.find(q => q.id === currentQId);
    if (!currentQ) return;

    const bots = session.players.filter(p => p.isBot);
    bots.forEach(bot => {
      // Random answer delay between 2.5s and (timePerQuestion - 2s)
      const maxDelay = Math.max(3000, (session.timePerQuestion - 3) * 1000);
      const delay = Math.floor(2500 + Math.random() * (maxDelay - 2500));

      const timer = setTimeout(() => {
        setActiveSession(prev => {
          if (!prev || prev.stage !== 'QUESTION') return prev;
          // Check if bot already answered
          const botPlayer = prev.players.find(p => p.id === bot.id);
          if (!botPlayer || botPlayer.answers.some(a => a.questionId === currentQId)) return prev;

          // 78% accuracy probability for realistic scoring distribution
          const isCorrect = Math.random() < 0.78;
          let selectedOption = currentQ.correctAnswer;
          if (!isCorrect) {
            const wrongOptions = [0, 1, 2, 3].filter(idx => idx !== currentQ.correctAnswer);
            selectedOption = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          }

          const timeTaken = delay / 1000;
          let points = 0;
          let newStreak = 0;

          if (isCorrect) {
            const speedRatio = Math.max(0, (session.timePerQuestion - timeTaken) / session.timePerQuestion);
            points = Math.round(1000 + speedRatio * 500 + Math.min(botPlayer.streak * 100, 500));
            newStreak = botPlayer.streak + 1;
          }

          const updatedPlayers = prev.players.map(p => {
            if (p.id === bot.id) {
              return {
                ...p,
                score: p.score + points,
                streak: newStreak,
                lastAnswerCorrect: isCorrect,
                lastPointsEarned: points,
                answers: [
                  ...p.answers,
                  {
                    questionId: currentQId,
                    selectedOption,
                    isCorrect,
                    timeTakenSeconds: timeTaken,
                    pointsEarned: points,
                  }
                ]
              };
            }
            return p;
          });

          const nextSession = { ...prev, players: updatedPlayers };
          broadcastSession(nextSession);
          return nextSession;
        });
      }, delay);

      botTimersRef.current.push(timer);
    });
  }, [questions, broadcastSession]);

  // Set game stage
  const setGameStage = (stage: GameStage) => {
    if (!activeSession) return;
    const now = Date.now();
    let updatedStatus = activeSession.status;
    if (stage === 'QUESTION' || stage === 'COUNTDOWN') {
      updatedStatus = 'IN_PROGRESS';
    } else if (stage === 'PODIUM') {
      updatedStatus = 'COMPLETED';
    }

    const updatedSession: QuizSession = {
      ...activeSession,
      stage,
      status: updatedStatus,
      stageStartTime: now,
    };

    setActiveSession(updatedSession);
    broadcastSession(updatedSession);

    if (stage === 'COUNTDOWN') {
      soundManager.playStart();
    } else if (stage === 'PODIUM') {
      soundManager.playVictory();
      // Record recap
      const sortedPlayers = [...updatedSession.players].sort((a, b) => b.score - a.score);
      const totalScore = sortedPlayers.reduce((acc, p) => acc + p.score, 0);
      const avg = sortedPlayers.length > 0 ? Math.round(totalScore / sortedPlayers.length) : 0;
      const recap: RecapRecord = {
        id: `recap-${updatedSession.pin}-${Date.now()}`,
        pin: updatedSession.pin,
        sessionTitle: updatedSession.title,
        date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        totalQuestions: updatedSession.questionIds.length,
        playersCount: updatedSession.players.length,
        averageScore: avg,
        players: sortedPlayers,
      };
      saveRecapRecord(recap);
      refreshRecaps();
    } else if (stage === 'QUESTION') {
      simulateBotAnswers(updatedSession);
    }
  };

  // Move to next question or end kuis
  const nextQuestion = () => {
    if (!activeSession) return;
    const nextIdx = activeSession.currentQuestionIndex + 1;
    if (nextIdx < activeSession.questionIds.length) {
      const updatedSession: QuizSession = {
        ...activeSession,
        currentQuestionIndex: nextIdx,
        stage: 'COUNTDOWN',
        stageStartTime: Date.now(),
      };
      setActiveSession(updatedSession);
      broadcastSession(updatedSession);
      soundManager.playStart();
    } else {
      setGameStage('PODIUM');
    }
  };

  const endGame = () => {
    setGameStage('PODIUM');
  };

  // Student methods
  const joinSession = (pin: string, name: string, nim?: string, avatar: string = '💙') => {
    const cleanPin = pin.trim();
    let session = activeSession && activeSession.pin === cleanPin ? activeSession : getStoredSessionByPin(cleanPin);

    if (!session) {
      return { success: false, error: `PIN sesi "${cleanPin}" tidak ditemukan. Pastikan Dosen sudah membuat sesi.` };
    }

    if (session.status === 'COMPLETED') {
      return { success: false, error: 'Sesi kuis ini sudah selesai.' };
    }

    // Check if player name already taken
    const existing = session.players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
    let player: Player;
    let updatedPlayers: Player[];

    if (existing) {
      player = existing;
      updatedPlayers = session.players;
    } else {
      player = {
        id: `student-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        nim: nim?.trim() || undefined,
        avatar,
        score: 0,
        streak: 0,
        answers: [],
      };
      updatedPlayers = [...session.players, player];
    }

    const updatedSession: QuizSession = {
      ...session,
      players: updatedPlayers,
    };

    setActiveSession(updatedSession);
    setCurrentPlayer(player);
    broadcastSession(updatedSession);
    soundManager.playTap();

    return { success: true };
  };

  const submitAnswer = (optionIndex: number, timeSpentSec: number) => {
    if (!activeSession || !currentPlayer) return;
    const currentQId = activeSession.questionIds[activeSession.currentQuestionIndex];
    const currentQ = questions.find(q => q.id === currentQId);
    if (!currentQ) return;

    // Check if player already answered this question
    const alreadyAnswered = currentPlayer.answers.some(a => a.questionId === currentQId);
    if (alreadyAnswered) return;

    const isCorrect = optionIndex === currentQ.correctAnswer;
    let pointsEarned = 0;
    let newStreak = 0;

    if (isCorrect) {
      // Base points + speed bonus + streak bonus
      const speedRatio = Math.max(0, (activeSession.timePerQuestion - timeSpentSec) / activeSession.timePerQuestion);
      pointsEarned = Math.round(1000 + speedRatio * 500 + Math.min(currentPlayer.streak * 100, 500));
      newStreak = currentPlayer.streak + 1;
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    const newAnswer = {
      questionId: currentQId,
      selectedOption: optionIndex,
      isCorrect,
      timeTakenSeconds: timeSpentSec,
      pointsEarned,
    };

    const updatedPlayer: Player = {
      ...currentPlayer,
      score: currentPlayer.score + pointsEarned,
      streak: newStreak,
      lastAnswerCorrect: isCorrect,
      lastPointsEarned: pointsEarned,
      answers: [...currentPlayer.answers, newAnswer],
    };

    const updatedPlayers = activeSession.players.map(p => 
      p.id === updatedPlayer.id ? updatedPlayer : p
    );

    const updatedSession: QuizSession = {
      ...activeSession,
      players: updatedPlayers,
    };

    setCurrentPlayer(updatedPlayer);
    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  const leaveSession = () => {
    setCurrentPlayer(null);
    setRole('HOME');
  };

  return (
    <QuizContext.Provider
      value={{
        role,
        setRole,
        questions,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        resetQuestions,
        activeSession,
        createSession,
        setGameStage,
        nextQuestion,
        endGame,
        addSimulatedStudents,
        kickPlayer,
        currentPlayer,
        joinSession,
        submitAnswer,
        leaveSession,
        isMuted,
        toggleMute,
        recaps,
        refreshRecaps,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
};
