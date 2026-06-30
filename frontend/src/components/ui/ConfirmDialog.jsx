'use client';

import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';

// Confirmation dialog for consequential actions (e.g. recording a payment).
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'primary' | 'danger'
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size={16} /> Working…
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </>
      }
    >
      {description}
    </Modal>
  );
}
