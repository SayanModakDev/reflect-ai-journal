import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  entryTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  entryTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="confirm-delete-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        id="confirm-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-xl border border-stone-200 text-stone-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-delete-modal-btn"
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-base font-semibold text-stone-900">
              Delete Reflection?
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              This action will permanently remove this entry from your cloud Firestore archive and emotional trendline. This cannot be undone.
            </p>
          </div>
        </div>

        {entryTitle && (
          <div className="mb-5 p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs font-medium text-stone-800 truncate">
            &ldquo;{entryTitle}&rdquo;
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            id="cancel-delete-btn"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{isDeleting ? "Deleting..." : "Delete Permanently"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
