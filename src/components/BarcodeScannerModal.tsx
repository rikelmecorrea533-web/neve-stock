import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Scan, Keyboard, AlertCircle } from 'lucide-react';
import { StockItem } from '../types/stock';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (scannedText: string) => void;
  items: StockItem[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanResult,
  items,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Câmera não suportada neste navegador.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Erro ao acessar câmera:', err);
      setCameraError(
        'Permissão de câmera não concedida ou dispositivo sem câmera traseira. Digite o código ou selecione um item abaixo.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScanResult(manualInput.trim());
    onClose();
  };

  const handleQuickPick = (nart: string) => {
    onScanResult(nart);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-auto animate-scale-up">
        {/* Topo */}
        <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scan className="w-5 h-5 text-blue-300" />
            <h2 className="text-base font-bold">Leitor de Código de Barras</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Visor da Câmera */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-700">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Guia de mira do código de barras */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-28 border-2 border-dashed border-red-500 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 animate-pulse" />
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="text-center p-4 text-slate-300 space-y-2">
                <Camera className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                <p className="text-xs">
                  {cameraError || 'Aponte a câmera para o código de barras do material Neve'}
                </p>
                {!cameraError && (
                  <button
                    onClick={startCamera}
                    className="mt-2 text-xs font-bold text-blue-400 hover:underline"
                  >
                    Ativar Câmera
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Entrada Manual de Código / NART */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Ou digite o NART / Código de Barras:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ex: 201045"
                autoFocus
                className="flex-1 py-2.5 px-3 text-sm font-bold border border-slate-300 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              <button
                type="submit"
                className="py-2.5 px-4 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-all cursor-pointer"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Atalhos Rápidos com Materiais Cadastrados */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Toque rápido para simular leitura (NARTs no lote):
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
              {items.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleQuickPick(item.nart)}
                  className="px-2 py-1 text-xs font-mono font-bold bg-white text-blue-900 hover:bg-blue-100 border border-slate-300 rounded shadow-xs cursor-pointer truncate max-w-[170px]"
                >
                  {item.nart} - {item.type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
