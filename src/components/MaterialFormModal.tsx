import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertCircle, Package } from 'lucide-react';
import { StockItem } from '../types/stock';
import { detectMaterialType, MaterialType } from '../utils/destinationRules';

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (materialData: Partial<StockItem>) => Promise<void>;
  onDelete?: (item: StockItem) => Promise<void>;
  itemToEdit: StockItem | null;
  activeFolderId: string;
}

export const MaterialFormModal: React.FC<MaterialFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  itemToEdit,
  activeFolderId,
}) => {
  const [nart, setNart] = useState('');
  const [description, setDescription] = useState('');
  const [lot, setLot] = useState('');
  const [systemQty, setSystemQty] = useState('');
  const [type, setType] = useState<MaterialType>('REVISAR');
  const [userOverrodeType, setUserOverrodeType] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setNart(itemToEdit.nart);
      setDescription(itemToEdit.description);
      setLot(itemToEdit.lot);
      setSystemQty(String(itemToEdit.systemQty));
      setType(itemToEdit.type);
      setUserOverrodeType(true);
    } else {
      setNart('');
      setDescription('');
      setLot('');
      setSystemQty('');
      setType('REVISAR');
      setUserOverrodeType(false);
    }
    setErrorMessage('');
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDesc = e.target.value;
    setDescription(newDesc);
    // Se o usuário não trocou o tipo manualmente, autodetectar:
    if (!userOverrodeType) {
      setType(detectMaterialType(newDesc));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nart.trim() || !description.trim() || !lot.trim() || !systemQty) {
      setErrorMessage('Preencha todos os campos obrigatórios.');
      return;
    }

    const qty = Number(systemQty);
    if (isNaN(qty) || qty < 0) {
      setErrorMessage('Informe uma quantidade válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        nart: nart.trim(),
        description: description.trim(),
        lot: lot.trim(),
        systemQty: qty,
        type,
        originWarehouse: 'ARMAZÉM 12',
        folderId: itemToEdit ? itemToEdit.folderId : activeFolderId,
      });
      onClose();
    } catch (err) {
      setErrorMessage('Erro ao salvar material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToEdit || !onDelete) return;
    if (
      confirm(
        `Confirma a exclusão do material "${itemToEdit.description}" (NART ${itemToEdit.nart})? Essa ação é irreversível e ficará registrada no histórico.`
      )
    ) {
      setIsSubmitting(true);
      try {
        await onDelete(itemToEdit);
        onClose();
      } catch (err) {
        setErrorMessage('Erro ao excluir material.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold">
              {itemToEdit ? 'Editar Material de Estoque' : 'Cadastrar Novo Material'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                NART (Código):
              </label>
              <input
                type="text"
                value={nart}
                onChange={(e) => setNart(e.target.value)}
                placeholder="Ex.: 100245"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:border-sky-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                Lote:
              </label>
              <input
                type="text"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Ex.: LT-202611A"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:border-sky-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
              Descrição do Material:
            </label>
            <input
              type="text"
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Ex.: CAMPO CIRÚRGICO SIMPLES 50X50CM"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm text-slate-900 focus:border-sky-600 outline-none"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              O tipo é detectado automaticamente se a descrição contiver "CAMPO" ou "COMPRESSA".
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                Saldo Sistêmico (Qtd):
              </label>
              <input
                type="number"
                value={systemQty}
                onChange={(e) => setSystemQty(e.target.value)}
                placeholder="0"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-base text-slate-900 focus:border-sky-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1">
                Origem:
              </label>
              <input
                type="text"
                disabled
                value="ARMAZÉM 12"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 font-black text-sm text-slate-700 outline-none"
              />
            </div>
          </div>

          {/* Tipo (com ajuste manual) */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-1.5">
              Tipo do Material:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['CAMPO', 'COMPRESSA', 'REVISAR'] as MaterialType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    setType(t);
                    setUserOverrodeType(true);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all ${
                    type === t
                      ? t === 'CAMPO'
                        ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm'
                        : t === 'COMPRESSA'
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-900 shadow-sm'
                        : 'bg-rose-100 border-rose-500 text-rose-900 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {errorMessage}
            </p>
          )}

          {/* Footer com botões */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            {itemToEdit && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="py-2.5 px-3.5 rounded-xl border-2 border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-5 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Save className="w-4 h-4 text-sky-400" />
                <span>{isSubmitting ? 'Salvando...' : 'Gravar Material'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
