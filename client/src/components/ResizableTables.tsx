import { useEffect } from 'react';

export default function ResizableTables() {
  useEffect(() => {
    const cleanupCallbacks: Array<() => void> = [];

    function applyResizers() {
      document.querySelectorAll<HTMLTableCellElement>('.table-wrap th').forEach((header) => {
        if (header.querySelector('.column-resizer')) return;
        const grip = document.createElement('span');
        grip.className = 'column-resizer';
        header.appendChild(grip);

        const onPointerDown = (event: PointerEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const startX = event.clientX;
          const startWidth = header.offsetWidth;
          const onPointerMove = (moveEvent: PointerEvent) => {
            const nextWidth = Math.max(72, startWidth + moveEvent.clientX - startX);
            header.style.width = `${nextWidth}px`;
            header.style.minWidth = `${nextWidth}px`;
          };
          const onPointerUp = () => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
          };
          document.addEventListener('pointermove', onPointerMove);
          document.addEventListener('pointerup', onPointerUp);
        };

        grip.addEventListener('pointerdown', onPointerDown);
        cleanupCallbacks.push(() => grip.removeEventListener('pointerdown', onPointerDown));
      });
    }

    applyResizers();
    const observer = new MutationObserver(applyResizers);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupCallbacks.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
