import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { loginWithMatricula, registerWithMatricula } from '../services/firebase';
import { UserProfile } from '../types/stock';

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'ENTRAR' | 'CRIAR'>('ENTRAR');

  // Formulário ENTRAR
  const [loginMatricula, setLoginMatricula] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Formulário CRIAR LOGIN
  const [createNome, setCreateNome] = useState('');
  const [createMatricula, setCreateMatricula] = useState('');
  const [createSenha, setCreateSenha] = useState('');
  const [createConfirmSenha, setCreateConfirmSenha] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const matricula = loginMatricula.trim();
    if (!matricula) {
      setLoginError('Informe sua matrícula ou usuário.');
      return;
    }
    if (!loginSenha) {
      setLoginError('Digite sua senha.');
      return;
    }

    setLoginLoading(true);
    try {
      const profile = await loginWithMatricula(matricula, loginSenha);
      onLoginSuccess(profile);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const nome = createNome.trim();
    const matricula = createMatricula.trim();

    if (!nome) {
      setCreateError('Informe o seu nome completo.');
      return;
    }
    if (!matricula) {
      setCreateError('Informe a sua matrícula ou usuário.');
      return;
    }
    if (createSenha.length < 6) {
      setCreateError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (createSenha !== createConfirmSenha) {
      setCreateError('As senhas não conferem. Digite a mesma senha nos dois campos.');
      return;
    }

    setCreateLoading(true);
    try {
      const profile = await registerWithMatricula(nome, matricula, createSenha);
      setCreateSuccess(true);
      setTimeout(() => {
        onLoginSuccess(profile);
      }, 1000);
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar conta.');
    } finally {
      setCreateLoading(false);
    }
  };

  const renderErrorBox = (err: string | null) => {
    if (!err) return null;

    if (err === 'AUTH_OPERATION_NOT_ALLOWED' || err.includes('operation-not-allowed')) {
      return (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2.5 animate-in fade-in">
          <div className="flex items-start gap-2 font-bold text-amber-900">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>Ativação necessária no Firebase Console (Passo único)</span>
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            O provedor <strong>E-mail/senha</strong> precisa ser ativado uma única vez no Console do Firebase do projeto <strong>avyon-app</strong> para liberar o cadastro dos operadores.
          </p>
          <div className="bg-white/95 p-3 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-2 shadow-xs">
            <div className="font-bold text-slate-800">Passo a passo rápido (30 segundos):</div>
            <ol className="list-decimal list-inside space-y-2 font-medium">
              <li>
                Abra a página de provedores de autenticação:
                <div className="mt-1">
                  <a
                    href="https://console.firebase.google.com/project/avyon-app/authentication/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors"
                  >
                    <span>Abrir Provedores no Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </li>
              <li>Na lista de provedores nativos, clique em <strong>E-mail/senha</strong></li>
              <li>Ative a primeira chave: <strong>Habilitar</strong> (não precisa ativar link do email)</li>
              <li>Clique no botão azul <strong>Salvar</strong></li>
            </ol>
          </div>
          <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
            ✓ Após salvar no console do Firebase, clique em CRIAR CONTA novamente que funcionará de primeira!
          </p>
        </div>
      );
    }

    return (
      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{err}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-blue-900 selection:text-white">
      {/* Faixa Superior com Banner Neve Medical */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">
        <div className="relative h-24 bg-[#0a192f] overflow-hidden">
          <img
            src="/neve_fabrica_banner.jpg"
            alt="Fábrica Neve Medical"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#0a192f]/75 backdrop-blur-[1px]" />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h1 className="text-xl font-black tracking-wider text-white">NEVE STOCK</h1>
            </div>
            <p className="text-[11px] text-slate-200/90 font-medium">
              Neve Medical – Bragança Paulista
            </p>
          </div>
        </div>

        {/* Abas: ENTRAR e CRIAR LOGIN */}
        <div className="flex border-b border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={() => {
              setTab('ENTRAR');
              setLoginError(null);
            }}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
              tab === 'ENTRAR'
                ? 'border-blue-900 text-blue-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>ENTRAR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('CRIAR');
              setCreateError(null);
            }}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
              tab === 'CRIAR'
                ? 'border-blue-900 text-blue-950 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>CRIAR LOGIN</span>
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-5 sm:p-6">
          {tab === 'ENTRAR' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <h2 className="text-base font-bold text-slate-800">Acesso ao Sistema</h2>
                <p className="text-xs text-slate-500">
                  Digite sua matrícula ou usuário e senha cadastrados
                </p>
              </div>

              {renderErrorBox(loginError)}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Matrícula ou Usuário
                </label>
                <input
                  type="text"
                  value={loginMatricula}
                  onChange={(e) => setLoginMatricula(e.target.value)}
                  placeholder="Ex: 1001 ou rikelme"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginSenha}
                    onChange={(e) => setLoginSenha(e.target.value)}
                    placeholder="Sua senha"
                    required
                    className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#0a192f] hover:bg-blue-900 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {loginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>ENTRAR NO SISTEMA</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setTab('CRIAR')}
                  className="text-xs text-blue-700 font-semibold hover:underline"
                >
                  Primeira vez? Crie seu login por aqui
                </button>
              </div>
            </form>
          )}

          {tab === 'CRIAR' && (
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="text-center pb-1">
                <h2 className="text-base font-bold text-slate-800">Criar Novo Login</h2>
                <p className="text-xs text-slate-500">
                  Cadastre sua matrícula para conferir e verificar tecidos
                </p>
              </div>

              {renderErrorBox(createError)}

              {createSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Conta criada com sucesso! Conectando...</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={createNome}
                  onChange={(e) => setCreateNome(e.target.value)}
                  placeholder="Ex: Rikelme Silva"
                  required
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Matrícula ou Usuário
                </label>
                <input
                  type="text"
                  value={createMatricula}
                  onChange={(e) => setCreateMatricula(e.target.value)}
                  placeholder="Ex: 1001"
                  required
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Identificador único usado nas conferências e verificações
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createSenha}
                    onChange={(e) => setCreateSenha(e.target.value)}
                    placeholder="Crie uma senha de no mínimo 6 dígitos"
                    required
                    className="w-full px-3.5 py-2 pr-10 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Senha
                </label>
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createConfirmSenha}
                  onChange={(e) => setCreateConfirmSenha(e.target.value)}
                  placeholder="Repita a senha digitada acima"
                  required
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50 focus:bg-white text-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={createLoading || createSuccess}
                className="w-full mt-2 py-3 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {createLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>CRIAR CONTA</span>
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setTab('ENTRAR')}
                  className="text-xs text-blue-700 font-semibold hover:underline"
                >
                  Já tem login? Voltar para ENTRAR
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-800" />
            <span>Banco de dados em tempo real compartilhado</span>
          </div>
        </div>
      </div>
    </div>
  );
};
