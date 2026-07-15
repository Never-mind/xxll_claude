import { Link } from 'react-router-dom';

export default function LinkedNumber({ to, children }: { to?: string; children: string }) {
  if (!to) return <span>{children}</span>;
  return <Link className="inline-link" to={to}>{children}</Link>;
}
