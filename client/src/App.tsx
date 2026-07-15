import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import ResizableTables from './components/ResizableTables.js';
import CustomerManage from './pages/CustomerManage.js';
import CustomerPoPage from './pages/CustomerPoPage.js';
import DashboardStatsPage from './pages/DashboardStatsPage.js';
import FinanceInvoicePage from './pages/FinanceInvoicePage.js';
import HistoryQuotationManage from './pages/HistoryQuotationManage.js';
import LoginPage from './pages/LoginPage.js';
import ProductManage from './pages/ProductManage.js';
import QuotationDetailPage from './pages/QuotationDetailPage.js';
import QuotationGenerate from './pages/QuotationGenerate.js';
import QuotationList from './pages/QuotationList.js';
import SettlementProjectDetailPage from './pages/SettlementProjectDetail.js';
import SettlementProjectList from './pages/SettlementProjectList.js';
import TariffRateManage from './pages/TariffRateManage.js';

const navGroups = [
  {
    title: '报价单',
    items: [
      ['/quotation/generate', '报价生成'],
      ['/quotation/list', '报价列表'],
      ['/history-quotations', '历史报价'],
    ],
  },
  {
    title: '财务',
    items: [
      ['/finance/invoices', '发票'],
    ],
  },
  {
    title: '用户',
    items: [
      ['/customers', '客户列表'],
    ],
  },
  {
    title: '产品',
    items: [
      ['/', '产品管理'],
      ['/tariff', '税率管理'],
    ],
  },
];

export default function App() {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState(() => ({
    username: localStorage.getItem('quotation.username') || '',
    token: localStorage.getItem('quotation.session') || '',
  }));

  function toggleGroup(title: string) {
    setCollapsedGroups((current) => ({ ...current, [title]: !current[title] }));
  }

  function handleLogin(username: string, token: string) {
    localStorage.setItem('quotation.username', username);
    localStorage.setItem('quotation.session', token);
    setSession({ username, token });
  }

  function handleLogout() {
    localStorage.removeItem('quotation.username');
    localStorage.removeItem('quotation.session');
    setSession({ username: '', token: '' });
  }

  if (!session.token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <ResizableTables />
      <aside className="sidebar">
        <div className="sidebar-top">
          {!sidebarCollapsed && <div className="brand">Selection Quote</div>}
          <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? '>' : '<'}
          </button>
        </div>
        {!sidebarCollapsed && (
          <nav className="sidebar-nav">
            <div className="user-strip">
              <span>{session.username}</span>
              <button type="button" onClick={handleLogout}>退出</button>
            </div>
            <NavLink to="/dashboard">统计面板</NavLink>
            <NavLink to="/customer-pos">客户PO</NavLink>
            <NavLink to="/settlement-projects">项目结算</NavLink>
            {navGroups.map((group) => (
              <div className="nav-section" key={group.title}>
                <button className="nav-section-title" type="button" onClick={() => toggleGroup(group.title)}>
                  <span>{group.title}</span>
                  <span aria-hidden="true">{collapsedGroups[group.title] ? '+' : '-'}</span>
                </button>
                {!collapsedGroups[group.title] && (
                  <div className="nav-section-links">
                    {group.items.map(([to, label]) => (
                      <NavLink key={to} to={to} end={to === '/'}>
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<ProductManage />} />
          <Route path="/customers" element={<CustomerManage />} />
          <Route path="/dashboard" element={<DashboardStatsPage />} />
          <Route path="/customer-pos" element={<CustomerPoPage />} />
          <Route path="/customer-pos/:id" element={<CustomerPoPage />} />
          <Route path="/finance" element={<FinanceInvoicePage />} />
          <Route path="/finance/invoices" element={<FinanceInvoicePage />} />
          <Route path="/tariff" element={<TariffRateManage />} />
          <Route path="/quotation/generate" element={<QuotationGenerate />} />
          <Route path="/quotation/generate/:id" element={<QuotationGenerate />} />
          <Route path="/quotation/list" element={<QuotationList />} />
          <Route path="/quotation/detail/:id" element={<QuotationDetailPage />} />
          <Route path="/history-quotations" element={<HistoryQuotationManage />} />
          <Route path="/settlement-projects" element={<SettlementProjectList />} />
          <Route path="/settlement-projects/:id" element={<SettlementProjectDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
