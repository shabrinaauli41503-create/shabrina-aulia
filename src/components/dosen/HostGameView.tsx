import React, { useState, useEffect } from 'react';
import { useQuiz } from '../../context/QuizContext';
import { 
  Play, Users, Trophy, Award, Copy, Check, 
  RotateCcw, Sparkles, CheckCircle2, FileSpreadsheet, Activity, Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundEffects';

export const HostGameView: React.FC = () => {
  const { 
    activeSession, 
    startSession, 
    endGame, 
    addSimulatedStudents, 
    kickPlayer, 
    questions 
  } = useQuiz();

  const [copied, setCopied] = useState(false);

  if (!activeSession) return null;

  const totalQuestions = activeSession.questionIds.length;
  const totalPlayers = activeSession.players.length;
  const finishedPlayers = activeSession.players.filter(p => p.isFinished).length;
  const inProgressPlayers = totalPlayers - finishedPlayers;

  // Sorted leaderboard
  const sortedPlayers = [...activeSession.players].sort((a, b) => b.score - a.score);
  const totalScore = activeSession.players.reduce((acc, p) => acc + p.score, 0);
  const avgScore = totalPlayers > 0 ? Math.round(totalScore / totalPlayers) : 0;

  // Podium confetti
  useEffect(() => {
    if (activeSession.status === 'COMPLETED') {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
        const timeout = setTimeout(() => {
          confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } });
          confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } });
        }, 600);
        return () => clearTimeout(timeout);
      } catch {
        // silent fallback
      }
    }
  }, [activeSession.status]);

  // Copy Direct Link with pre-filled PIN
  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quizzyonline.vercel.app';
    const link = `${origin}/?pin=${activeSession.pin}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    soundManager.playTap();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPinOnly = () => {
    navigator.clipboard.writeText(activeSession.pin);
    setCopied(true);
    soundManager.playTap();
    setTimeout(() => setCopied(false), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const rows = [
      ['Peringkat', 'Nama Mahasiswa', 'NIM', 'Skor Total', 'Soal Terjawab', 'Status'],
      ...sortedPlayers.map((p, idx) => [
        `#${idx + 1}`,
        p.name,
        p.nim || '-',
        p.score.toString(),
        `${p.answers.length}/${totalQuestions}`,
        p.isFinished ? 'Selesai' : 'Sedang Mengerjakan'
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Nilai_Quizzy_PIN_${activeSession.pin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* ======================================================== */}
      {/* 1. LOBBY VIEW (WAITING FOR STUDENTS TO JOIN)             */}
      {/* ======================================================== */}
      {activeSession.status === 'WAITING' && (
        <div className="space-y-8">
          
          {/* Header Banner */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sesi Kuis Terbuka · Bagikan PIN ke Mahasiswa</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
              {activeSession.title}
            </h2>

            {/* Giant PIN Display */}
            <div className="max-w-md mx-auto p-6 bg-slate-950 border border-slate-800 rounded-3xl shadow-inner relative group space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
                GAME PIN PERMAINAN
              </div>
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 select-all">
                {activeSession.pin}
              </div>

              {/* Action buttons to copy link or PIN */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Link Tersalin!' : 'Salin Link Langsung (Auto-PIN)'}</span>
                </button>

                <button
                  onClick={handleCopyPinOnly}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin PIN Saja</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Mahasiswa cukup membuka link di atas dari HP, maka PIN akan otomatis terisi dan mahasiswa langsung terhubung ke ruang ini.
            </p>
          </div>

          {/* Roster of joined students */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Users className="w-4 h-4 text-sky-400" />
                <span>Mahasiswa yang Sudah Terhubung ({totalPlayers} Orang)</span>
              </div>

              <button
                onClick={() => {
                  soundManager.playTap();
                  addSimulatedStudents(6);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Tambah Simulasi 6 Teman Kelas (Uji Cepat)</span>
              </button>
            </div>

            {totalPlayers === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-700 animate-spin mx-auto" />
                <p>Menunggu mahasiswa memasukkan PIN {activeSession.pin} dari HP mereka...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {activeSession.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl group hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{p.avatar}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {p.nim || (p.isBot ? 'Bot Mahasiswa' : 'Mahasiswa')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => kickPlayer(p.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Keluarkan dari sesi"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              Total Soal: <strong className="text-white">{totalQuestions} Soal</strong> · Waktu: <strong className="text-white">{activeSession.timePerQuestion} detik/soal</strong> · Mode: <strong className="text-sky-400">Mandiri Serentak (Auto-Flow)</strong>
            </div>

            <button
              disabled={totalPlayers === 0}
              onClick={() => {
                soundManager.playStart();
                startSession();
              }}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm shadow-xl transition-all ${
                totalPlayers > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Mulai Kuis Sekarang ({totalPlayers} Peserta)</span>
            </button>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. LIVE MONITORING VIEW (QUIZ IN PROGRESS)               */}
      {/* ======================================================== */}
      {activeSession.status === 'IN_PROGRESS' && (
        <div className="space-y-6">
          
          {/* Top Dosen Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Monitoring Proyektor Dosen · Live Kuis</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                    Sedang Berjalan
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Mahasiswa menjawab mandiri dari HP masing-masing tanpa perlu menunggu giliran.
                </div>
              </div>
            </div>

            {/* End / Finish action */}
            <button
              onClick={() => {
                soundManager.playTap();
                endGame();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/30 transition-all self-start sm:self-auto"
            >
              <Trophy className="w-4 h-4" />
              <span>Tutup Kuis & Buka Podium Juara 🏆</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Total Peserta</div>
              <div className="text-2xl font-black font-mono text-white mt-0.5">{totalPlayers}</div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Sedang Menjawab</div>
              <div className="text-2xl font-black font-mono text-sky-400 mt-0.5">{inProgressPlayers}</div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Sudah Selesai</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">{finishedPlayers}</div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Rata-Rata Skor</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">{avgScore.toLocaleString()}</div>
            </div>
          </div>

          {/* Live Student Progress Cards */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Kemajuan Pengerjaan Setiap Mahasiswa (Live Real-Time)</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">Auto-refresh per detik</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeSession.players.map((p) => {
                const currentQ = p.currentQuestionIndex || 0;
                const percent = Math.min(100, Math.round((currentQ / totalQuestions) * 100));

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      p.isFinished
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{p.avatar}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {p.nim || (p.isBot ? 'Bot' : 'Mahasiswa')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-sky-400">
                          {p.score.toLocaleString()} pts
                        </div>
                        {p.streak >= 2 && (
                          <div className="text-[10px] text-rose-400 font-mono">
                            🔥 {p.streak}x
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>{p.isFinished ? '🏁 Selesai Semua Soal' : `Soal ${currentQ}/${totalQuestions}`}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            p.isFinished ? 'bg-emerald-400' : 'bg-sky-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Top Leaderboard */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Klasemen Sementara Peringkat Teratas</span>
            </h3>

            <div className="space-y-2">
              {sortedPlayers.slice(0, 5).map((p, rank) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-400 w-5">
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                    </span>
                    <span>{p.avatar}</span>
                    <span className="font-bold text-white">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-slate-400">
                      {p.isFinished ? '🏁 Selesai' : `Soal ${p.currentQuestionIndex || 0}/${totalQuestions}`}
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      {p.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PODIUM & RECAP VIEW (COMPLETED)                       */}
      {/* ======================================================== */}
      {activeSession.status === 'COMPLETED' && (
        <div className="space-y-8 py-2">
          
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5" />
              <span>Kuis Pemrograman Web Selesai</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
              Podium Juara Kuis
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Selamat kepada para juara! Rekap nilai telah otomatis tersimpan di sistem.
            </p>
          </div>

          {/* 3D Step Podium */}
          <div className="flex items-end justify-center gap-3 sm:gap-6 pt-10 pb-6 max-w-xl mx-auto">
            {/* Rank 2 (Silver) */}
            {sortedPlayers[1] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-3xl mb-1">{sortedPlayers[1].avatar}</div>
                <div className="text-xs font-bold text-white text-center truncate max-w-[100px] mb-1">
                  {sortedPlayers[1].name}
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-400 mb-2">
                  {sortedPlayers[1].score.toLocaleString()} pts
                </div>
                <div className="w-full h-36 bg-gradient-to-t from-slate-800 to-slate-700 border-t-4 border-slate-300 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-xl">
                  <span className="text-3xl font-black text-slate-300">2</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Juara II</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {sortedPlayers[0] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-4xl mb-1 animate-bounce">👑</div>
                <div className="text-4xl mb-1">{sortedPlayers[0].avatar}</div>
                <div className="text-sm font-bold text-amber-300 text-center truncate max-w-[120px] mb-1">
                  {sortedPlayers[0].name}
                </div>
                <div className="text-xs font-mono font-bold text-amber-400 mb-2">
                  {sortedPlayers[0].score.toLocaleString()} pts
                </div>
                <div className="w-full h-48 bg-gradient-to-t from-amber-700/80 to-amber-500/80 border-t-4 border-yellow-300 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-2xl shadow-amber-500/20">
                  <Trophy className="w-8 h-8 text-yellow-200 mb-1" />
                  <span className="text-4xl font-black text-yellow-100">1</span>
                  <span className="text-[10px] uppercase tracking-wider text-yellow-200 font-bold">Juara Utama</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {sortedPlayers[2] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-3xl mb-1">{sortedPlayers[2].avatar}</div>
                <div className="text-xs font-bold text-white text-center truncate max-w-[100px] mb-1">
                  {sortedPlayers[2].name}
                </div>
                <div className="text-[11px] font-mono font-bold text-amber-500 mb-2">
                  {sortedPlayers[2].score.toLocaleString()} pts
                </div>
                <div className="w-full h-28 bg-gradient-to-t from-amber-950 to-amber-900 border-t-4 border-amber-600 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-xl">
                  <span className="text-3xl font-black text-amber-400">3</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-400/80 font-bold">Juara III</span>
                </div>
              </div>
            )}
          </div>

          {/* Full Rank Table & CSV Export */}
          <div className="max-w-2xl mx-auto bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Daftar Lengkap Nilai Seluruh Mahasiswa ({sortedPlayers.length})
              </h4>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh Excel / CSV</span>
              </button>
            </div>

            <div className="space-y-1.5 divide-y divide-slate-800/50">
              {sortedPlayers.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-slate-500 w-5">#{idx + 1}</span>
                    <span>{p.avatar}</span>
                    <span className="text-white font-medium">{p.name}</span>
                    {p.nim && <span className="text-slate-500 text-[10px]">({p.nim})</span>}
                  </div>
                  <div className="font-mono font-bold text-sky-400">
                    {p.score.toLocaleString()} pts
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Restart / New Session Action */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => {
                soundManager.playTap();
                window.location.reload();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Selesai & Buat Sesi Kuis Baru</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
