import { type MouseEvent, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart2,
  FilePlus2,
  FileText,
  Factory,
  LogOut,
  Package,
  ReceiptText,
  Tags,
  Users,
  X,
} from 'lucide-react';
import ResizableTables from './components/ResizableTables.js';
import CustomerManage from './pages/CustomerManage.js';
import CustomerDetailPage from './pages/CustomerDetailPage.js';
import ContractingEntityManage from './pages/ContractingEntityManage.js';
import ContractingEntityDetailPage from './pages/ContractingEntityDetailPage.js';
import CustomerPoPage from './pages/CustomerPoPage.js';
import DashboardStatsPage from './pages/DashboardStatsPage.js';
import FinanceInvoicePage from './pages/FinanceInvoicePage.js';
import HistoryQuotationManage from './pages/HistoryQuotationManage.js';
import LoginPage from './pages/LoginPage.js';
import ProductManage from './pages/ProductManage.js';
import ProductArchivePreview from './pages/ProductArchivePreview.js';
import ProductListPreview from './pages/ProductListPreview.js';
import ProductModelPreview from './pages/ProductModelPreview.js';
import QuotationDetailPage from './pages/QuotationDetailPage.js';
import QuotationGenerate from './pages/QuotationGenerate.js';
import QuotationList from './pages/QuotationList.js';
import SettlementProjectDetailPage from './pages/SettlementProjectDetail.js';
import SettlementProjectList from './pages/SettlementProjectList.js';
import SupplierDetailPage from './pages/SupplierDetailPage.js';
import SupplierManage from './pages/SupplierManage.js';
import TariffRateManage from './pages/TariffRateManage.js';

const primaryNavItems = [
  { to: '/dashboard', label: '\u7edf\u8ba1\u9762\u677f', icon: BarChart3 },
  { to: '/customer-pos', label: '\u5ba2\u6237PO', icon: ClipboardList },
  { to: '/settlement-projects', label: '\u9879\u76ee\u7ed3\u7b97', icon: BriefcaseBusiness },
];

const navGroups = [
  {
    title: '\u62a5\u4ef7\u5355',
    items: [
      { to: '/quotation/generate', label: '\u62a5\u4ef7\u751f\u6210', icon: FilePlus2 },
      { to: '/quotation/list', label: '\u62a5\u4ef7\u5217\u8868', icon: FileText },
      { to: '/history-quotations', label: '\u5386\u53f2\u62a5\u4ef7', icon: FileBarChart2 },
    ],
  },
  {
    title: '\u8d22\u52a1',
    items: [
      { to: '/finance/invoices', label: '\u53d1\u7968', icon: ReceiptText },
    ],
  },
  {
    title: '\u7528\u6237',
    items: [
      { to: '/customers', label: '\u5ba2\u6237\u5217\u8868', icon: Users },
      { to: '/contracting-entities', label: '\u627f\u63a5\u5355\u4f4d', icon: Building2 },
    ],
  },
  {
    title: '\u4ea7\u54c1',
    items: [
      { to: '/', label: '\u4ea7\u54c1\u7ba1\u7406', icon: Package },
      { to: '/suppliers', label: '\u4f9b\u5e94\u5546\u7ba1\u7406', icon: Factory },
      { to: '/tariff', label: '\u7a0e\u7387\u7ba1\u7406', icon: Tags },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/': '\u4ea7\u54c1\u7ba1\u7406',
  '/product-model-preview': '\u4ea7\u54c1\u7ed3\u6784\u9884\u89c8',
  '/product-archive-preview': '\u4ea7\u54c1\u4e3b\u6863\u9884\u89c8',
  '/product-list-preview': '\u4ea7\u54c1\u4e3b\u6863\u5217\u8868\u9884\u89c8',
  '/customers': '\u5ba2\u6237\u5217\u8868',
  '/contracting-entities': '\u627f\u63a5\u5355\u4f4d',
  '/suppliers': '\u4f9b\u5e94\u5546\u7ba1\u7406',
  '/dashboard': '\u7edf\u8ba1\u9762\u677f',
  '/customer-pos': '\u5ba2\u6237PO',
  '/finance': '\u53d1\u7968',
  '/finance/invoices': '\u53d1\u7968',
  '/tariff': '\u7a0e\u7387\u7ba1\u7406',
  '/quotation/generate': '\u62a5\u4ef7\u751f\u6210',
  '/quotation/list': '\u62a5\u4ef7\u5217\u8868',
  '/history-quotations': '\u5386\u53f2\u62a5\u4ef7',
  '/settlement-projects': '\u9879\u76ee\u7ed3\u7b97',
};

type WorkspaceTab = {
  key: string;
  pathname: string;
  search: string;
  hash: string;
  title: string;
  pinned?: boolean;
};

function routeTitle(pathname: string): string {
  return pageTitles[pathname]
    || (pathname.startsWith('/quotation/detail/') ? '\u62a5\u4ef7\u5355\u8be6\u60c5' : '')
    || (pathname.startsWith('/customer-pos/') ? '\u5ba2\u6237PO\u8be6\u60c5' : '')
    || (pathname.startsWith('/customers/') ? '\u5ba2\u6237\u6863\u6848' : '')
    || (pathname.startsWith('/contracting-entities/') ? '\u627f\u63a5\u5355\u4f4d\u6863\u6848' : '')
    || (pathname.startsWith('/suppliers/') ? '\u4f9b\u5e94\u5546\u6863\u6848' : '')
    || (pathname.startsWith('/settlement-projects/') ? '\u9879\u76ee\u7ed3\u7b97\u8be6\u60c5' : 'Selection Quote');
}

function routeParentTitle(pathname: string): string {
  if (pathname.startsWith('/quotation/detail/') || pathname.startsWith('/quotation/generate')) return '\u62a5\u4ef7\u5217\u8868';
  if (pathname.startsWith('/customer-pos/')) return '\u5ba2\u6237PO';
  if (pathname.startsWith('/customers/')) return '\u5ba2\u6237\u5217\u8868';
  if (pathname.startsWith('/contracting-entities/')) return '\u627f\u63a5\u5355\u4f4d';
  if (pathname.startsWith('/suppliers/')) return '\u4f9b\u5e94\u5546\u7ba1\u7406';
  if (pathname.startsWith('/settlement-projects/')) return '\u9879\u76ee\u7ed3\u7b97';
  return '';
}

function tabForLocation(location: { pathname: string; search: string; hash: string }): WorkspaceTab {
  const key = workspaceKey(location);
  return {
    key,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    title: routeTitle(location.pathname),
    pinned: location.pathname === '/dashboard',
  };
}

function workspaceKey(location: { pathname: string; search: string; hash: string }): string {
  const { pathname } = location;
  if (pathname === '/customers/new' || pathname.startsWith('/customers/')) return 'customer-detail';
  if (pathname === '/suppliers/new' || pathname.startsWith('/suppliers/')) return 'supplier-detail';
  if (pathname === '/contracting-entities/new' || pathname.startsWith('/contracting-entities/')) return 'contracting-entity-detail';
  if (pathname === '/customer-pos/new' || pathname.startsWith('/customer-pos/')) return 'customer-po-detail';
  if (pathname === '/quotation/generate' || pathname.startsWith('/quotation/generate/')) return 'quotation-editor';
  if (pathname.startsWith('/quotation/detail/')) return 'quotation-detail';
  if (pathname.startsWith('/settlement-projects/')) return 'settlement-project-detail';
  return `${pathname}${location.search}${location.hash}`;
}

function mergeWorkspaceTab(tabs: WorkspaceTab[], nextTab: WorkspaceTab): WorkspaceTab[] {
  const index = tabs.findIndex((tab) => tab.key === nextTab.key);
  if (index < 0) return [...tabs, nextTab];
  const current = tabs[index];
  if (current.pathname === nextTab.pathname && current.search === nextTab.search && current.hash === nextTab.hash && current.title === nextTab.title) return tabs;
  return tabs.map((tab, tabIndex) => tabIndex === index ? { ...nextTab, pinned: current.pinned || nextTab.pinned } : tab);
}

function normalizeWorkspaceTabs(tabs: WorkspaceTab[]): WorkspaceTab[] {
  return tabs.reduce<WorkspaceTab[]>((result, tab) => mergeWorkspaceTab(result, tabForLocation(tab)), []);
}

function initialWorkspaceTabs(location: { pathname: string; search: string; hash: string }): WorkspaceTab[] {
  const dashboardTab = tabForLocation({ pathname: '/dashboard', search: '', hash: '' });
  try {
    const saved = JSON.parse(sessionStorage.getItem('quotation.workspace-tabs') || '[]') as WorkspaceTab[];
    const validTabs = normalizeWorkspaceTabs(saved.filter((tab) => tab?.key && tab.pathname));
    const currentTab = tabForLocation(location);
    const tabs = mergeWorkspaceTab(validTabs, currentTab);
    return tabs.some((tab) => tab.pathname === '/dashboard') ? tabs : [dashboardTab, ...tabs];
  } catch {
    const currentTab = tabForLocation(location);
    return currentTab.key === dashboardTab.key ? [dashboardTab] : [dashboardTab, currentTab];
  }
}

export default function App() {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => ({
    username: localStorage.getItem('quotation.username') || '',
    token: localStorage.getItem('quotation.session') || '',
  }));
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>(() => initialWorkspaceTabs(location));

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

  const currentTab = tabForLocation(location);
  const pageTitle = currentTab.title;
  const parentTitle = routeParentTitle(location.pathname);

  useEffect(() => {
    setWorkspaceTabs((current) => mergeWorkspaceTab(current, currentTab));
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    sessionStorage.setItem('quotation.workspace-tabs', JSON.stringify(workspaceTabs));
  }, [workspaceTabs]);

  function closeWorkspaceTab(event: MouseEvent<HTMLElement>, tabKey: string) {
    event.stopPropagation();
    const tab = workspaceTabs.find((item) => item.key === tabKey);
    if (!tab || tab.pinned) return;
    const index = workspaceTabs.findIndex((item) => item.key === tabKey);
    const remaining = workspaceTabs.filter((item) => item.key !== tabKey);
    setWorkspaceTabs(remaining);
    if (tabKey === currentTab.key) {
      const nextTab = remaining[index - 1] || remaining[index] || tabForLocation({ pathname: '/dashboard', search: '', hash: '' });
      navigate(`${nextTab.pathname}${nextTab.search}${nextTab.hash}`);
    }
  }

  if (!session.token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <ResizableTables />
      <aside className="sidebar">
        <div className="sidebar-top">
          {sidebarCollapsed ? <div className="brand-mark">SQ</div> : <div className="brand">Selection Quote</div>}
          <button className="sidebar-toggle" type="button" title={sidebarCollapsed ? '\u5c55\u5f00\u5bfc\u822a' : '\u6536\u8d77\u5bfc\u822a'} aria-label={sidebarCollapsed ? '\u5c55\u5f00\u5bfc\u822a' : '\u6536\u8d77\u5bfc\u822a'} onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        {!sidebarCollapsed && (
          <nav className="sidebar-nav">
            {primaryNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className="sidebar-link">
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            ))}
            {navGroups.map((group) => (
              <div className="nav-section" key={group.title}>
                <button className="nav-section-title" type="button" onClick={() => toggleGroup(group.title)}>
                  <span>{group.title}</span>
                  <ChevronDown className={collapsedGroups[group.title] ? 'is-collapsed' : ''} size={15} />
                </button>
                {!collapsedGroups[group.title] && (
                  <div className="nav-section-links">
                    {group.items.map(({ to, label, icon: Icon }) => (
                      <NavLink key={to} to={to} end={to === '/'} className="sidebar-link">
                        <Icon size={16} strokeWidth={1.8} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}
      </aside>
      <main className="main-area">
        <header className="workspace-header">
          <div className="workspace-crumb">
            <span>Selection Quote</span>
            <ChevronRight size={15} />
            {parentTitle && <><span>{parentTitle}</span><ChevronRight size={15} /></>}
            <strong>{pageTitle}</strong>
          </div>
          <div className="workspace-user">
            <span className="workspace-avatar">{session.username.slice(0, 1).toUpperCase() || 'A'}</span>
            <span className="workspace-user-name">{session.username}</span>
            <button className="topbar-logout" type="button" title={'\u9000\u51fa\u767b\u5f55'} aria-label={'\u9000\u51fa\u767b\u5f55'} onClick={handleLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="workspace-tabs" role="tablist" aria-label={'\u5df2\u6253\u5f00\u9875\u9762'}>
          {workspaceTabs.map((tab) => (
            <button key={tab.key} className={`workspace-tab${tab.key === currentTab.key ? ' active' : ''}`} type="button" role="tab" aria-selected={tab.key === currentTab.key} onClick={() => navigate(`${tab.pathname}${tab.search}${tab.hash}`)}>
              <span>{tab.title}</span>
              {!tab.pinned && <span className="workspace-tab-close" role="button" aria-label={`\u5173\u95ed${tab.title}`} onClick={(event) => closeWorkspaceTab(event, tab.key)}><X size={14} /></span>}
            </button>
          ))}
        </div>
        <div className="workspace-route-cache">
          {workspaceTabs.map((tab) => (
            <div className={`workspace-route-pane${tab.key === currentTab.key ? ' active' : ''}`} key={tab.key}>
              <div className="content">
                <ApplicationRoutes location={tab} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function ApplicationRoutes({ location }: { location: Pick<WorkspaceTab, 'pathname' | 'search' | 'hash'> }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<ProductManage />} />
      <Route path="/product-model-preview" element={<ProductModelPreview />} />
      <Route path="/product-archive-preview" element={<ProductArchivePreview />} />
      <Route path="/product-list-preview" element={<ProductListPreview />} />
      <Route path="/customers" element={<CustomerManage />} />
      <Route path="/customers/new" element={<CustomerDetailPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/contracting-entities" element={<ContractingEntityManage />} />
      <Route path="/contracting-entities/new" element={<ContractingEntityDetailPage />} />
      <Route path="/contracting-entities/:id" element={<ContractingEntityDetailPage />} />
      <Route path="/suppliers" element={<SupplierManage />} />
      <Route path="/suppliers/new" element={<SupplierDetailPage />} />
      <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
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
  );
}
