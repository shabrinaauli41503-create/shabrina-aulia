import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { QuizQuestion, QuizSession, Player, AppRole, GameStage, PlayerAnswer } from '../types/quiz';
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
import { 
  pushSessionToCloud, 
  fetchSessionFromCloud, 
  savePlayerToCloud, 
  fetchAllPlayersForPin 
} from '../utils/cloudSync';

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
  startSession: () => void;
  endGame: () => void;
  addSimulatedStudents: (count?: number) => void;
  kickPlayer: (playerId: string) => void;
  
  // Mahasiswa / Player methods
  currentPlayer: Player | null;
  joinSession: (pin: string, name: string, nim?: string, avatar?: string) => Promise<{ success: boolean; error?: string }>;
  submitStudentAnswer: (optionIndex: number, timeSpentSec: number) => { isCorrect: boolean; points: number; nextIndex: number; isFinished: boolean };
  advanceToNextQuestion: () => void;
  leaveSession: () => void;
  syncWithCloud: () => Promise<void>;

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
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cross-tab local sync via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('quizzy_sync_v4');
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SESSION_UPDATED') {
          setActiveSession(payload);
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

  // Broadcast session changes locally & push to cloud
  const broadcastSession = useCallback((session: QuizSession) => {
    saveStoredSession(session);
    pushSessionToCloud(session);
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'SESSION_UPDATED', payload: session });
      } catch {
        // silent
      }
    }
  }, []);

  // HOST POLLER: Polls cloud every 1 second to pick up all students (joining & answering)
  useEffect(() => {
    if (role !== 'DOSEN' || !activeSession || !activeSession.pin) return;
    const pin = activeSession.pin;

    const pollInterval = setInterval(async () => {
      try {
        const cloudPlayers = await fetchAllPlayersForPin(pin);
        if (!cloudPlayers || cloudPlayers.length === 0) return;

        setActiveSession(prev => {
          if (!prev || prev.pin !== pin) return prev;

          let hasChanges = false;
          const currentList = [...prev.players];

          for (const cp of cloudPlayers) {
            const idx = currentList.findIndex(
              p => p.id === cp.id || p.name.trim().toLowerCase() === cp.name.trim().toLowerCase()
            );

            if (idx === -1) {
              // New student joined from phone/external device!
              currentList.push(cp);
              hasChanges = true;
            } else {
              // Existing student submitted answer or progressed
              const existing = currentList[idx];
              if (
                cp.answers.length !== existing.answers.length ||
                cp.score !== existing.score ||
                cp.currentQuestionIndex !== existing.currentQuestionIndex ||
                cp.isFinished !== existing.isFinished
              ) {
                currentList[idx] = {
                  ...existing,
                  ...cp,
                  isBot: existing.isBot || cp.isBot,
                };
                hasChanges = true;
              }
            }
          }

          if (!hasChanges) return prev;

          const updated: QuizSession = {
            ...prev,
            players: currentList,
          };

          saveStoredSession(updated);
          pushSessionToCloud(updated);
          return updated;
        });
      } catch (err) {
        // silent
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [role, activeSession?.pin]);

  // STUDENT POLLER: Polls cloud every 1 second to detect when Dosen starts the quiz or finishes
  useEffect(() => {
    if (role !== 'MAHASISWA' || !activeSession || !activeSession.pin) return;
    const pin = activeSession.pin;

    const pollInterval = setInterval(async () => {
      try {
        const cloudSession = await fetchSessionFromCloud(pin);
        if (!cloudSession) return;

        setActiveSession(prev => {
          if (!prev) return cloudSession;

          const statusChanged = cloudSession.status !== prev.status;
          const stageChanged = cloudSession.stage !== prev.stage;
          const playerCountChanged = cloudSession.players.length !== prev.players.length;

          if (statusChanged || stageChanged || playerCountChanged) {
            saveStoredSession(cloudSession);
            return cloudSession;
          }
          return prev;
        });

        // Sync player's own record from cloud if updated
        if (currentPlayer) {
          const me = cloudSession.players.find(
            p => p.id === currentPlayer.id || p.name.trim().toLowerCase() === currentPlayer.name.trim().toLowerCase()
          );
          if (me && (me.score !== currentPlayer.score || me.answers.length > currentPlayer.answers.length)) {
            setCurrentPlayer(me);
          }
        }
      } catch {
        // silent
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [role, activeSession?.pin, currentPlayer?.id]);

  const syncWithCloud = async () => {
    if (!activeSession || !activeSession.pin) return;
    try {
      const cloudSession = await fetchSessionFromCloud(activeSession.pin);
      if (cloudSession) {
        setActiveSession(cloudSession);
        saveStoredSession(cloudSession);
        if (currentPlayer) {
          const me = cloudSession.players.find(
            p => p.id === currentPlayer.id || p.name.trim().toLowerCase() === currentPlayer.name.trim().toLowerCase()
          );
          if (me) setCurrentPlayer(me);
        }
      }
    } catch {
      // silent
    }
  };

  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const refreshRecaps = () => {
    setRecaps(getStoredRecap());
  };

  // Question CRUD
  const addQuestion = (newQ: Omit<QuizQuestion, 'id'>) => {
    const id = `web-custom-${Date.now()}`;
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

  // Host: Create session
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
      title: title || 'Quizzy! - Kuis Interaktif Pemrograman Web',
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

  // Host starts the session: All joined students can now answer!
  const startSession = () => {
    if (!activeSession) return;
    const updated: QuizSession = {
      ...activeSession,
      status: 'IN_PROGRESS',
      stage: 'QUESTION',
      stageStartTime: Date.now(),
    };
    setActiveSession(updated);
    broadcastSession(updated);
    soundManager.playStart();

    // Start bot simulation if bots are in session
    simulateBots(updated);
  };

  // Simulate bot students answering gradually
  const simulateBots = (session: QuizSession) => {
    if (botIntervalRef.current) clearInterval(botIntervalRef.current);

    const bots = session.players.filter(p => p.isBot && !p.isFinished);
    if (bots.length === 0) return;

    botIntervalRef.current = setInterval(() => {
      setActiveSession(prev => {
        if (!prev || prev.status !== 'IN_PROGRESS') return prev;

        let changed = false;
        const totalQ = prev.questionIds.length;

        const updatedPlayers = prev.players.map(p => {
          if (!p.isBot || p.isFinished) return p;

          // 40% chance per tick to answer their next question
          if (Math.random() < 0.45) {
            const currentQIndex = p.currentQuestionIndex || 0;
            if (currentQIndex < totalQ) {
              const qId = prev.questionIds[currentQIndex];
              const qObj = questions.find(q => q.id === qId);
              const isCorrect = Math.random() < 0.8;
              const points = isCorrect ? Math.round(900 + Math.random() * 500) : 0;
              const nextIndex = currentQIndex + 1;
              const isFinished = nextIndex >= totalQ;

              changed = true;
              return {
                ...p,
                score: p.score + points,
                streak: isCorrect ? p.streak + 1 : 0,
                currentQuestionIndex: nextIndex,
                isFinished,
                answers: [
                  ...p.answers,
                  {
                    questionId: qId,
                    selectedOption: isCorrect ? (qObj?.correctAnswer ?? 0) : ((qObj?.correctAnswer ?? 0) + 1) % 4,
                    isCorrect,
                    timeTakenSeconds: Math.round(3 + Math.random() * 10),
                    pointsEarned: points,
                  }
                ]
              };
            }
          }
          return p;
        });

        if (!changed) return prev;
        const nextSession = { ...prev, players: updatedPlayers };
        saveStoredSession(nextSession);
        pushSessionToCloud(nextSession);
        return nextSession;
      });
    }, 2000);
  };

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
      currentQuestionIndex: 0,
      isFinished: false,
      answers: [],
    }));

    const updatedSession: QuizSession = {
      ...activeSession,
      players: [...activeSession.players, ...newBots],
    };

    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  const kickPlayer = (playerId: string) => {
    if (!activeSession) return;
    const updatedSession: QuizSession = {
      ...activeSession,
      players: activeSession.players.filter(p => p.id !== playerId),
    };
    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  const setGameStage = (stage: GameStage) => {
    if (!activeSession) return;
    const updated: QuizSession = {
      ...activeSession,
      stage,
      stageStartTime: Date.now(),
    };
    setActiveSession(updated);
    broadcastSession(updated);
  };

  const endGame = () => {
    if (!activeSession) return;
    if (botIntervalRef.current) clearInterval(botIntervalRef.current);

    const sortedPlayers = [...activeSession.players].sort((a, b) => b.score - a.score);
    const totalScore = sortedPlayers.reduce((acc, p) => acc + p.score, 0);
    const avg = sortedPlayers.length > 0 ? Math.round(totalScore / sortedPlayers.length) : 0;

    const recap: RecapRecord = {
      id: `recap-${activeSession.pin}-${Date.now()}`,
      pin: activeSession.pin,
      sessionTitle: activeSession.title,
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      totalQuestions: activeSession.questionIds.length,
      playersCount: activeSession.players.length,
      averageScore: avg,
      players: sortedPlayers,
    };

    saveRecapRecord(recap);
    refreshRecaps();
    soundManager.playVictory();

    const updatedSession: QuizSession = {
      ...activeSession,
      status: 'COMPLETED',
      stage: 'PODIUM',
    };
    setActiveSession(updatedSession);
    broadcastSession(updatedSession);
  };

  // Student join method
  const joinSession = async (pin: string, name: string, nim?: string, avatar: string = '💙'): Promise<{ success: boolean; error?: string }> => {
    const cleanPin = pin.trim();
    let session = activeSession && activeSession.pin === cleanPin ? activeSession : getStoredSessionByPin(cleanPin);

    if (!session) {
      const cloudSession = await fetchSessionFromCloud(cleanPin);
      if (cloudSession) session = cloudSession;
    }

    if (!session) {
      return { 
        success: false, 
        error: `PIN "${cleanPin}" tidak ditemukan. Pastikan Dosen sudah membuka sesi kuis baru dan membagikan PIN di layar.` 
      };
    }

    const player: Player = {
      id: `mhs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      nim: nim?.trim() || undefined,
      avatar,
      score: 0,
      streak: 0,
      currentQuestionIndex: 0,
      isFinished: false,
      answers: [],
    };

    // Save to isolated student cloud key
    await savePlayerToCloud(cleanPin, player);

    const updatedSession: QuizSession = {
      ...session,
      players: [...session.players.filter(p => p.name.toLowerCase() !== player.name.toLowerCase()), player],
    };

    setActiveSession(updatedSession);
    setCurrentPlayer(player);
    saveStoredSession(updatedSession);
    soundManager.playTap();

    return { success: true };
  };

  // Student submits answer and gets instant feedback, then advances to next question
  const submitStudentAnswer = (
    optionIndex: number, 
    timeSpentSec: number
  ): { isCorrect: boolean; points: number; nextIndex: number; isFinished: boolean } => {
    if (!activeSession || !currentPlayer) {
      return { isCorrect: false, points: 0, nextIndex: 0, isFinished: false };
    }

    const currentQIdx = currentPlayer.currentQuestionIndex || 0;
    const currentQId = activeSession.questionIds[currentQIdx];
    const currentQ = questions.find(q => q.id === currentQId);

    const isCorrect = currentQ ? optionIndex === currentQ.correctAnswer : false;
    let pointsEarned = 0;
    let newStreak = 0;

    if (isCorrect) {
      const timePerQ = activeSession.timePerQuestion || 20;
      const speedRatio = Math.max(0, (timePerQ - timeSpentSec) / timePerQ);
      pointsEarned = Math.round(1000 + speedRatio * 500 + Math.min(currentPlayer.streak * 100, 500));
      newStreak = currentPlayer.streak + 1;
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    const newAnswer: PlayerAnswer = {
      questionId: currentQId,
      selectedOption: optionIndex,
      isCorrect,
      timeTakenSeconds: timeSpentSec,
      pointsEarned,
    };

    const nextIndex = currentQIdx + 1;
    const isFinished = nextIndex >= activeSession.questionIds.length;

    const updatedPlayer: Player = {
      ...currentPlayer,
      score: currentPlayer.score + pointsEarned,
      streak: newStreak,
      lastAnswerCorrect: isCorrect,
      lastPointsEarned: pointsEarned,
      currentQuestionIndex: currentQIdx, // Keep at current until advance
      isFinished,
      finishedAt: isFinished ? Date.now() : undefined,
      answers: [...currentPlayer.answers, newAnswer],
    };

    setCurrentPlayer(updatedPlayer);

    // Save to cloud key
    savePlayerToCloud(activeSession.pin, updatedPlayer);

    return {
      isCorrect,
      points: pointsEarned,
      nextIndex,
      isFinished,
    };
  };

  // Advance player to next question
  const advanceToNextQuestion = () => {
    if (!activeSession || !currentPlayer) return;
    const nextIdx = (currentPlayer.currentQuestionIndex || 0) + 1;
    const isFinished = nextIdx >= activeSession.questionIds.length;

    const updated: Player = {
      ...currentPlayer,
      currentQuestionIndex: nextIdx,
      isFinished,
      finishedAt: isFinished ? Date.now() : undefined,
    };

    setCurrentPlayer(updated);
    savePlayerToCloud(activeSession.pin, updated);

    if (isFinished) {
      soundManager.playVictory();
    }
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
        startSession,
        setGameStage,
        endGame,
        addSimulatedStudents,
        kickPlayer,
        currentPlayer,
        joinSession,
        submitStudentAnswer,
        advanceToNextQuestion,
        leaveSession,
        syncWithCloud,
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
