import React from 'react';
import { useQuiz } from '../../context/QuizContext';
import { Trophy, CheckCircle2, XCircle, Award, RotateCcw, ArrowRight, Flame, Sparkles } from 'lucide-react';
import { soundManager } from '../../utils/soundEffects';

export const MahasiswaResultView: React.FC = () => {
  const { currentPlayer, activeSession, questions, leaveSession } = useQuiz();

  if (!currentPlayer || !activeSession) return null;

  const totalQuestions = activeSession.questionIds.length;
  const correctCount = currentPlayer.answers.filter(a => a.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Rank among all players in session
  const sortedPlayers = [...activeSession.players].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex(p => p.id === currentPlayer.id) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      
      {/* Hero Victory Card */}
      <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="text-6xl animate-bounce">
          {myRank === 1 ? '👑' : myRank <= 3 ? '🏆' : '🎉'}
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Kuis Selesai Dikerjakan!</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            Selamat, {currentPlayer.name}!
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            NIM: {currentPlayer.nim || 'Mahasiswa'} · Game PIN: {activeSession.pin}
          </p>
        </div>

        {/* Score & Rank Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 font-mono">Skor Akhir</div>
            <div className="text-xl font-extrabold font-mono text-sky-400 mt-0.5">
              {currentPlayer.score.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 font-mono">Peringkat</div>
            <div className="text-xl font-extrabold font-mono text-amber-400 mt-0.5">
              #{myRank > 0 ? myRank : 1} <span className="text-xs text-slate-500">/ {sortedPlayers.length}</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 font-mono">Benar / Salah</div>
            <div className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5">
              {correctCount} <span className="text-xs text-rose-400">/ {wrongCount}</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 font-mono">Akurasi</div>
            <div className="text-xl font-extrabold font-mono text-indigo-400 mt-0.5">
              {accuracy}%
            </div>
          </div>
        </div>
      </div>

      {/* Live Classroom Leaderboard Table */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Papan Klasemen Kelas Sementara ({sortedPlayers.length} Mahasiswa)</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Real-time update</span>
        </div>

        <div className="space-y-2">
          {sortedPlayers.slice(0, 10).map((p, idx) => {
            const isMe = p.id === currentPlayer.id;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                  isMe
                    ? 'bg-sky-500/20 border-sky-400 text-white font-bold ring-2 ring-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-slate-500 w-6">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span>{p.avatar}</span>
                  <div className="truncate">
                    <span>{p.name}</span>
                    {isMe && <span className="text-sky-300 ml-1.5">(Anda)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400">
                    {p.isFinished ? '🏁 Selesai' : `Soal ${p.currentQuestionIndex || 0}/${totalQuestions}`}
                  </span>
                  <span className="font-mono font-bold text-sky-400">
                    {p.score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Answers Breakdown */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Pembahasan & Riwayat Jawaban Anda</span>
        </h3>

        <div className="space-y-3">
          {currentPlayer.answers.map((ans, idx) => {
            const qObj = questions.find(q => q.id === ans.questionId);
            if (!qObj) return null;

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  ans.isCorrect
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-200">
                    <span className="font-mono text-sky-400 mr-1.5">#{idx + 1}</span>
                    {qObj.question}
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    ans.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {ans.isCorrect ? `+${ans.pointsEarned} pts` : 'Salah (0 pts)'}
                  </div>
                </div>

                <div className="text-[11px] space-y-1">
                  <div className="text-slate-400">
                    Pilihan Anda: <strong className={ans.isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                      {qObj.options[ans.selectedOption] || 'Tidak menjawab'}
                    </strong>
                  </div>
                  {!ans.isCorrect && (
                    <div className="text-slate-400">
                      Jawaban Benar: <strong className="text-emerald-400">{qObj.options[qObj.correctAnswer]}</strong>
                    </div>
                  )}
                  <div className="text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="text-sky-400 font-semibold">Penjelasan: </span>
                    {qObj.explanation}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="text-center pt-2">
        <button
          onClick={() => {
            soundManager.playTap();
            leaveSession();
          }}
          className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
        >
          Keluar ke Halaman Utama
        </button>
      </div>

    </div>
  );
};
