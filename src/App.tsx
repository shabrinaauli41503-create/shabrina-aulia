/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QuizProvider, useQuiz } from './context/QuizContext';
import { Header } from './components/common/Header';
import { HomeLanding } from './components/home/HomeLanding';
import { DosenDashboard } from './components/dosen/DosenDashboard';
import { MahasiswaJoin } from './components/mahasiswa/MahasiswaJoin';
import { MahasiswaWaitingRoom } from './components/mahasiswa/MahasiswaWaitingRoom';
import { MahasiswaPlayView } from './components/mahasiswa/MahasiswaPlayView';
import { MahasiswaPodiumView } from './components/mahasiswa/MahasiswaPodiumView';
import { SoloPlayView } from './components/solo/SoloPlayView';

const MainRouter: React.FC = () => {
  const { role, currentPlayer, activeSession } = useQuiz();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1">
        {/* HOME VIEW */}
        {role === 'HOME' && <HomeLanding />}

        {/* DOSEN PANEL */}
        {role === 'DOSEN' && <DosenDashboard />}

        {/* MAHASISWA ROLE */}
        {role === 'MAHASISWA' && (
          <div>
            {!currentPlayer ? (
              <MahasiswaJoin />
            ) : !activeSession || activeSession.status === 'WAITING' ? (
              <MahasiswaWaitingRoom />
            ) : activeSession.status === 'COMPLETED' ? (
              <MahasiswaPodiumView />
            ) : (
              <MahasiswaPlayView />
            )}
          </div>
        )}

        {/* SOLO PRACTICE MODE */}
        {role === 'SOLO' && <SoloPlayView />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <QuizProvider>
      <MainRouter />
    </QuizProvider>
  );
}
