import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({ 
  isOpen, title, message, onConfirm, onCancel, confirmText = '確定', cancelText = '取消' 
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="chalk-box relative z-10 max-w-sm w-full bg-[#2b5b3f] shadow-2xl p-6 border-yellow-400"
          >
            <h3 className="text-xl font-bold text-yellow-300 mb-3">{title}</h3>
            <p className="text-white/90 mb-6 whitespace-pre-wrap">{message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={onCancel} className="chalk-btn bg-black/20 hover:bg-black/40 text-white/80">
                {cancelText}
              </button>
              <button onClick={onConfirm} className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold border-yellow-400 shadow-lg">
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
