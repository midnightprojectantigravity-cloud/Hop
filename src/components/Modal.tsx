import React from 'react';

export const Modal: React.FC<{ title?: string; onClose: () => void; children?: React.ReactNode }> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-70" onClick={onClose} />
      <div className="relative bg-gradient-to-br from-[#2b1f17] to-[#1b0f0b] p-6 rounded-lg shadow-2xl max-w-md w-full border border-[#6b4b31]">
        {title && <div className="font-bold mb-2 text-amber-200 text-lg">{title}</div>}
        <div className="text-sm text-amber-100">{children}</div>
        <div className="mt-4 text-right">
          <button className="bg-[#6b4b31] text-amber-100 px-3 py-1 rounded" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
