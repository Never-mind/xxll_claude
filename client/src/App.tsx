import { NavLink, Route, Routes } from 'react-router-dom';
import CustomerManage from './pages/CustomerManage.js';
import DashboardStatsPage from './pages/DashboardStatsPage.js';
import HistoryQuotationManage from './pages/HistoryQuotationManage.js';
import ProductManage from './pages/ProductManage.js';
import QuotationDetailPage from './pages/QuotationDetailPage.js';
import QuotationGenerate from './pages/QuotationGenerate.js';
import QuotationList from './pages/QuotationList.js';
import TariffRateManage from './pages/TariffRateManage.js';

const nav = [
  ['/dashboard', '统计面板'],
  ['/', '产品管理'],
  ['/customers', '客户列表'],
  ['/tariff', '税率管理'],
  ['/quotation/generate', '报价生成'],
  ['/quotation/list', '报价列表'],
  ['/history-quotations', '历史报价'],
];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Selection Quote</div>
        <nav>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<ProductManage />} />
          <Route path="/customers" element={<CustomerManage />} />
          <Route path="/dashboard" element={<DashboardStatsPage />} />
          <Route path="/tariff" element={<TariffRateManage />} />
          <Route path="/quotation/generate" element={<QuotationGenerate />} />
          <Route path="/quotation/generate/:id" element={<QuotationGenerate />} />
          <Route path="/quotation/list" element={<QuotationList />} />
          <Route path="/quotation/detail/:id" element={<QuotationDetailPage />} />
          <Route path="/history-quotations" element={<HistoryQuotationManage />} />
        </Routes>
      </main>
    </div>
  );
}
