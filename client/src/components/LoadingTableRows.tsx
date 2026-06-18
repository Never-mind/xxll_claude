interface LoadingTableRowsProps {
  columns: number;
  rows?: number;
}

export default function LoadingTableRows({ columns, rows = 6 }: LoadingTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr className="skeleton-row" key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex}>
              <span className="skeleton-line" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
