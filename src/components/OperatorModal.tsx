import React, { useState } from 'react';
import { User, CheckCircle2, ShieldCheck } from 'lucide-react';

interface OperatorModalProps {
  isOpen: boolean;
  currentOperator: string;
  onSave: (operatorName: string) => void;
  canClose: boolean;
}

export const OperatorModal: React.FC<OperatorModalProps> = ({
  isOpen,
  currentOperator,
  onSave,
  canClose,
}) => {
  const [name, setName] = useState(currentOperator || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Por favor, informe seu nome ou matrícula para continuar.');
      return;
    }
    setError('');
    onSave(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 text-white p-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/40 border border-blue-400/30 flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-blue-200" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Identificação do Operador</h2>
          <p className="text-sm text-blue-200 mt-1">
            Cada ação, conferência e destinação de estoque será registrada com seu nome e horário.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Nome do Operador ou Matrícula
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ex: Rikelme Correa"
              autoFocus
              className="w-full px-4 py-3 text-base font-semibold border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none text-slate-900 transition-all placeholder:text-slate-400"
            />
            {error && <p className="text-xs font-semibold text-rose-600 mt-1.5">{error}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <p>
              O nome ficará salvo neste aparelho e poderá ser alterado a qualquer momento no topo da tela.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            {canClose && (
              <button
                type="button"
                onClick={() => onSave(currentOperator)}
                className="w-1/3 py-3 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-all"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 px-6 rounded-xl text-base font-bold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 shadow-lg shadow-blue-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirmar Operador</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
