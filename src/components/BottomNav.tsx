import React, { useState } from 'react';
import {
  LayoutDashboard,
  Folder,
  Search,
  MoreHorizontal,
  BookOpen,
  Clock,
  KeyRound,
  LogOut,
  X,
  User,
  Shield,
} from 'lucide-react';
import { UserProfile } from '../types/stock';

export type MainTab = 'hoje' | 'pastas' | 'buscar' | 'catalogo' | 'historico';

interface BottomNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentUser?: UserProfile | null;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenChangePassword,
  onLogout,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isMaisActive = currentTab === 'catalogo' || currentTab === 'historico';

  return (
    <>
      {/* Menu flutuante do botão 'Mais' */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="relative bg-white rounded-3xl p-4 sm:p-5 shadow-2xl max-w-md mx-auto w-full border border-slate-200">
            {/* Cabeçalho do menu */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Mais Opções</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cartão de Identificação do Operador Conectado */}
            {currentUser && (
              <div className="my-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0a192f] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {currentUser.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 leading-tight">
                      {currentUser.nome}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      Matrícula: <span className="font-bold text-blue-900">{currentUser.matricula}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Conectado
                </span>
              </div>
            )}

            <div className="py-1 space-y-1">
              {/* Catálogo de Tecidos */}
              <button
                onClick={() => {
                  onSelectTab('catalogo');
                  setShowMoreMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  currentTab === 'catalogo'
                    ? 'bg-blue-50 text-blue-800 font-bold'
                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm">Catálogo de Tecidos</div>
                  <div className="text-xs text-slate-400 font-normal">13 tecidos oficiais e tipos</div>
                </div>
              </button>

              {/* Histórico */}
              <button
                onClick={() => {
                  onSelectTab('historico');
                  setShowMoreMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  currentTab === 'historico'
                    ? 'bg-blue-50 text-blue-800 font-bold'
                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm">Histórico de Auditoria</div>
                  <div className="text-xs text-slate-400 font-normal">Ações e conferências em tempo real</div>
                </div>
              </button>

              {/* Trocar Senha */}
              {onOpenChangePassword && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenChangePassword();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 text-slate-700 font-medium transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm">Trocar Senha</div>
                    <div className="text-xs text-slate-400 font-normal">Atualizar a senha de acesso</div>
                  </div>
                </button>
              )}

              {/* Sair da Conta (Logout) */}
              {onLogout && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-rose-50 text-rose-700 font-medium transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Sair da Conta</div>
                    <div className="text-xs text-rose-400 font-normal">Desconectar deste aparelho</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior Fixa */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          {/* Aba Hoje */}
          <button
            onClick={() => onSelectTab('hoje')}
            className={`flex flex-col items-center justify-center gap-1 transition-all select-none ${
              currentTab === 'hoje'
                ? 'text-[#0a192f] font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${currentTab === 'hoje' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px]">Hoje</span>
          </button>

          {/* Aba Pastas */}
          <button
            onClick={() => onSelectTab('pastas')}
            className={`flex flex-col items-center justify-center gap-1 transition-all select-none ${
              currentTab === 'pastas'
                ? 'text-[#0a192f] font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Folder className={`w-5 h-5 ${currentTab === 'pastas' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px] notranslate" translate="no">Pastas</span>
          </button>

          {/* Aba Buscar */}
          <button
            onClick={() => onSelectTab('buscar')}
            className={`flex flex-col items-center justify-center gap-1 transition-all select-none ${
              currentTab === 'buscar'
                ? 'text-[#0a192f] font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Search className={`w-5 h-5 ${currentTab === 'buscar' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px]">Buscar</span>
          </button>

          {/* Aba Mais */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center gap-1 transition-all select-none ${
              isMaisActive
                ? 'text-[#0a192f] font-bold scale-105'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 ${isMaisActive ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[11px]">
              {currentTab === 'catalogo'
                ? 'Catálogo'
                : currentTab === 'historico'
                ? 'Histórico'
                : 'Mais'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
