import React from 'react';
import { Wifi, WifiOff, RefreshCw, User, ChevronLeft } from 'lucide-react';

interface HeaderProps {
  isHome: boolean;
  screenTitle?: string;
  onBack?: () => void;
  operatorName: string;
  onOpenOperatorModal: () => void;
  isOnline: boolean;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isHome,
  screenTitle = 'NEVE STOCK',
  onBack,
  operatorName,
  onOpenOperatorModal,
  isOnline,
  isSyncing,
}) => {
  if (isHome) {
    return (
      <header className="relative w-full h-[88px] max-h-[90px] rounded-b-2xl overflow-hidden shadow-md select-none bg-slate-900">
        {/* Foto da fábrica como faixa fina */}
        <img
          src="/neve_fabrica_banner.jpg"
          alt="Fábrica Neve Medical"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Camada azul-marinho escura com opacidade 70% */}
        <div className="absolute inset-0 bg-[#0a192f]/70 backdrop-blur-[1px]" />

        {/* Conteúdo sobreposto */}
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-300/40"></span>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white drop-shadow-sm">
                NEVE STOCK
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-200/90 font-medium tracking-wide">
              Neve Medical – Bragança Paulista
            </p>
          </div>

          {/* Status de Rede & Operador */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Indicador de Conexão */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-sm transition-colors ${
                isSyncing
                  ? 'bg-amber-500/80 text-white animate-pulse'
                  : isOnline
                  ? 'bg-emerald-600/60 text-white'
                  : 'bg-rose-600/80 text-white'
              }`}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="hidden xs:inline">Sincronizando</span>
                </>
              ) : isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-300" />
                  <span className="hidden xs:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-200" />
                  <span className="hidden xs:inline">Offline</span>
                </>
              )}
            </div>

            {/* Botão Operador */}
            <button
              onClick={onOpenOperatorModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all border border-white/20 active:scale-95"
              title="Trocar operador ativo"
            >
              <User className="w-3.5 h-3.5 text-blue-200" />
              <span className="max-w-[90px] sm:max-w-[120px] truncate">{operatorName || 'Operador'}</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Barra de 56 px para as outras telas com botão voltar
  return (
    <header className="sticky top-0 z-40 w-full h-14 max-h-[56px] bg-[#0a192f] text-white shadow-md border-b border-slate-800">
      <div className="h-full max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-base sm:text-lg font-bold text-white truncate">
            {screenTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Status simplificado */}
          {isSyncing ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-500/30 text-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Sincronizando</span>
            </span>
          ) : !isOnline ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-rose-500/30 text-rose-300">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          ) : null}

          <button
            onClick={onOpenOperatorModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-slate-200 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span className="max-w-[70px] sm:max-w-[110px] truncate">{operatorName || 'Operador'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
