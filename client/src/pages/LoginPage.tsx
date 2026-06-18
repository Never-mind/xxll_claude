import { FormEvent, useState } from 'react';
import { login } from '../api.js';

interface LoginPageProps {
  onLogin: (username: string, token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login({ username, password });
      onLogin(result.username, result.token);
    } catch {
      setError('用户名或密码错误');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <div className="login-brand">Selection Quote</div>
          <h1>系统登录</h1>
          <p>请输入账号密码进入报价管理系统。</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="请输入密码"
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary-action" type="submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
