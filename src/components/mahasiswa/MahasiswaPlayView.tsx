import React, { useState, useEffect, useRef } from 'react';
import { useQuiz } from '../../context/QuizContext';
import { 
  CheckCircle2, XCircle, Clock, Sparkles, Flame, 
  ArrowRight, RotateCw
} from 'lucide-react';
import { soundManager } from '../../utils/soundEffects';
import { MahasiswaResultView } from './MahasiswaResultView';

const OPTION_STYLES = [
  { bg: 'bg-rose-600', activeBg: 'active:bg-rose-700', shape: '▲', label: 'A' },
  { bg: 'bg-sky-600', activeBg: 'active:bg-sky-700', shape: '◆', label: 'B' },
  { bg: 'bg-amber-500', activeBg: 'active:bg-amber-600', shape: '●', label: 'C' },
  { bg: 'bg-emerald-600', activeBg: 'active:bg-emerald-700', shape: '■', label: 'D' },
];

export const MahasiswaPlayView: React.FC = () => {
  const { 
    activeSession, 
    currentPlayer, 
    submitStudentAnswer, 
    advanceToNextQuestion, 
    questions 
  } = useQuiz();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number>(2);

  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  if (!activeSession || !currentPlayer) return null;

  const currentQIdx = currentPlayer.currentQuestionIndex || 0;
  const totalQuestions = activeSession.questionIds.length;

  // If student has finished all questions, render the Result View!
  if (currentPlayer.isFinished || currentQIdx >= totalQuestions) {
    return <MahasiswaResultView />;
  }

  const currentQId = activeSession.questionIds[currentQIdx];
  const currentQ = questions.find(q => q.id === currentQId);

  // Reset timer on new question
  useEffect(() => {
    setSelectedOption(null);
    setIsRevealing(false);
    setLastResult(null);
    questionStartTimeRef.current = Date.now();
    const timeLimit = activeSession.timePerQuestion || 20;
    setTimeLeft(timeLimit);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Timeout reached: Auto-submit as unanswered
          handleTimeout();
          return 0;
        }
        if (prev <= 4) {
          soundManager.playTick(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQIdx, activeSession.timePerQuestion]);

  // Clean up advance timer
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  const handleTimeout = () => {
    if (isRevealing) return;
    const timeSpent = activeSession.timePerQuestion || 20;
    const res = submitStudentAnswer(-1, timeSpent);
    setLastResult(res);
    setIsRevealing(true);
    triggerAutoAdvance();
  };

  const handleSelectOption = (idx: number) => {
    if (isRevealing) return;
    setSelectedOption(idx);
    soundManager.playTap();

    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    const res = submitStudentAnswer(idx, timeSpent);
    setLastResult(res);
    setIsRevealing(true);

    triggerAutoAdvance();
  };

  const triggerAutoAdvance = () => {
    let countdown = 2;
    setAutoAdvanceTimer(countdown);

    const countdownInterval = setInterval(() => {
      countdown -= 1;
      setAutoAdvanceTimer(countdown);
      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    advanceTimeoutRef.current = setTimeout(() => {
      handleManualAdvance();
    }, 2200);
  };

  const handleManualAdvance = () => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    advanceToNextQuestion();
  };

  if (!currentQ) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      
      {/* Top Header: Player Avatar, Name, Question Progress, Score */}
      <div className="flex items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentPlayer.avatar}</span>
          <div>
            <div className="text-xs font-bold text-white leading-tight">{currentPlayer.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Soal {currentQIdx + 1} / {totalQuestions}
            </div>
          </div>
        </div>

        {/* Current Score & Streak */}
        <div className="flex items-center gap-3">
          {currentPlayer.streak >= 2 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-mono font-bold">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{currentPlayer.streak}x</span>
            </div>
          )}

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-mono">Skor Anda</div>
            <div className="text-sm font-bold font-mono text-sky-400">
              {currentPlayer.score.toLocaleString()} <span className="text-[10px] text-slate-500">pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Timer Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Sisa Waktu: <strong className={timeLeft <= 5 ? 'text-rose-400 font-bold' : 'text-white'}>{timeLeft}s</strong></span>
          <span>Kemajuan: <strong className="text-sky-400">{Math.round(((currentQIdx + 1) / totalQuestions) * 100)}%</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${
                timeLeft <= 5 ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-indigo-500'
              }`}
              style={{ width: `${(timeLeft / (activeSession.timePerQuestion || 20)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-sky-400">{currentQ.category}</span>
          <span className="text-[11px] font-mono text-slate-500">{currentQ.difficulty}</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold font-display text-white leading-relaxed">
          {currentQ.question}
        </h3>

        {currentQ.codeSnippet && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
            <pre className="text-xs font-mono text-emerald-400">
              <code>{currentQ.codeSnippet}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Answer Options Grid (4 Kahoot-style buttons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentQ.options.map((option, idx) => {
          const style = OPTION_STYLES[idx];
          const isSelected = selectedOption === idx;
          const isCorrectAnswer = idx === currentQ.correctAnswer;

          let btnClass = `${style.bg} ${style.activeBg} text-white shadow-lg cursor-pointer`;

          if (isRevealing) {
            if (isCorrectAnswer) {
              btnClass = 'bg-emerald-600 border-2 border-white ring-4 ring-emerald-500/40 text-white shadow-xl scale-[1.01]';
            } else if (isSelected && !isCorrectAnswer) {
              btnClass = 'bg-rose-800 border-2 border-rose-500 text-white opacity-80';
            } else {
              btnClass = 'bg-slate-900 border border-slate-800 text-slate-500 opacity-40 cursor-not-allowed';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isRevealing}
              onClick={() => handleSelectOption(idx)}
              className={`p-4 rounded-2xl flex items-center gap-3.5 text-left transition-all font-semibold text-sm ${btnClass}`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-bold text-base shrink-0">
                {style.shape}
              </div>
              <span className="flex-1 leading-snug">{option}</span>

              {isRevealing && isCorrectAnswer && (
                <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
              )}
              {isRevealing && isSelected && !isCorrectAnswer && (
                <XCircle className="w-5 h-5 text-rose-300 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Instant Reveal Feedback & Next Question Bar */}
      {isRevealing && lastResult && (
        <div className={`p-4 rounded-2xl border space-y-2.5 transition-all shadow-xl animate-in fade-in slide-in-from-bottom-2 ${
          lastResult.isCorrect 
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{lastResult.isCorrect ? '🎉' : '❌'}</span>
              <div>
                <div className="font-bold text-sm text-white">
                  {lastResult.isCorrect ? 'Jawaban Anda Benar!' : 'Jawaban Kurang Tepat!'}
                </div>
                {lastResult.isCorrect && (
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    +{lastResult.points.toLocaleString()} Poin Kecepatan!
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleManualAdvance}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-900 font-bold text-xs rounded-xl shadow-md hover:bg-slate-100 transition-colors"
            >
              <span>Soal Berikutnya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80">
            <span className="font-semibold text-sky-400">Pembahasan: </span>
            {currentQ.explanation}
          </div>
        </div>
      )}

    </div>
  );
};
