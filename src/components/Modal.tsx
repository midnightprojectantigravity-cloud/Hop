import React from 'react';

export const Modal: React.FC<{ title?: string; onClose: () => void; children?: React.ReactNode }> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-60" onClick={onClose} />
      <div className="relative bg-gray-900 p-4 rounded shadow max-w-md w-full">
        {title && <div className="font-bold mb-2">{title}</div>}
        <div>{children}</div>
        <div className="mt-4 text-right">
          <button className="bg-gray-700 px-3 py-1 rounded" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
