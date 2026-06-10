interface FieldVisibilityDialogProps {
  fields: Array<{ key: string; label: string }>;
  visibleKeys: string[];
  title?: string;
  onChange: (keys: string[]) => void;
  onClose: () => void;
}

export default function FieldVisibilityDialog({ fields, visibleKeys, title = '字段显示', onChange, onClose }: FieldVisibilityDialogProps) {
  const visibleSet = new Set(visibleKeys);

  function toggle(key: string, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...visibleKeys, key])));
      return;
    }
    onChange(visibleKeys.filter((item) => item !== key));
  }

  return (
    <div className="modal-backdrop feedback-backdrop" role="dialog" aria-modal="true">
      <div className="modal field-visibility-dialog">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" type="button" onClick={onClose}>x</button>
        </div>
        <div className="field-visibility-actions">
          <button type="button" onClick={() => onChange(fields.map((field) => field.key))}>全选</button>
          <button type="button" onClick={() => onChange([])}>全部隐藏</button>
        </div>
        <div className="field-visibility-grid">
          {fields.map((field) => (
            <label key={field.key}>
              <input
                type="checkbox"
                checked={visibleSet.has(field.key)}
                onChange={(event) => toggle(field.key, event.target.checked)}
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
        <footer className="modal-actions">
          <button className="primary-action" type="button" onClick={onClose}>确定</button>
        </footer>
      </div>
    </div>
  );
}
