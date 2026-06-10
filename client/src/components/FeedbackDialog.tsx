interface FeedbackDialogProps {
  message: string;
  title?: string;
  onClose: () => void;
}

export default function FeedbackDialog({ message, title = '系统提醒', onClose }: FeedbackDialogProps) {
  if (!message) return null;
  return (
    <div className="modal-backdrop feedback-backdrop" role="dialog" aria-modal="true">
      <div className="feedback-dialog">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" type="button" onClick={onClose}>x</button>
        </div>
        <p>{message}</p>
        <footer className="modal-actions">
          <button className="primary-action" type="button" onClick={onClose}>知道了</button>
        </footer>
      </div>
    </div>
  );
}
