import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DetailBackButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return <button className="detail-back-button" type="button" aria-label={label} title={label} onClick={() => navigate(to)}><ArrowLeft size={17} /></button>;
}
