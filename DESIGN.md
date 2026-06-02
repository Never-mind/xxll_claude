# Selection Quote System Design Specification

## Style Source

The current UI direction is derived from the product screenshots in `screen/`:

- `产品管理列表样式.png`
- `关税税率管理样式.png`
- `报价模块生成页面样式.png`
- `搜索框、搜索、导入、导出按钮样式.png`
- `新增产品表单样式.png`

The visual language is a light enterprise admin workspace: flat white work surfaces, precise grey borders, compact blue primary actions, dense but readable tables, and form controls designed for repeated data entry.

## Pages Updated

The screenshot style maps to these existing pages and shared components:

| Area | Files | Applied updates |
| --- | --- | --- |
| Product management | `client/src/pages/ProductManage.tsx`, `AdminTable.tsx` | Product title, image column, search toolbar, import/export actions, table and modal styling |
| Tariff rate management | `client/src/pages/TariffRateManage.tsx`, `AdminTable.tsx` | Title, search toolbar, import/export actions, table density and status-like checkbox styling |
| History quotation management | `AdminTable.tsx` | Shared admin toolbar, import/export, modal and table styling |
| Quotation generation | `client/src/pages/QuotationGenerate.tsx` | Searchable product picker, product chips, selected item table, shared panel/input/table styling |
| Quotation list/detail/dashboard | Shared CSS | Buttons, badges, tables, panels, metrics, and page background aligned to the new style |

## Design Direction

### Selected: Light Line-Table Admin

Use the screenshots as the source of truth. The app keeps its current navigation and workflows, but the surface treatment becomes lighter and more operational:

- White background surfaces with thin grey borders.
- Tables are the primary interface element.
- Search and action controls sit in a horizontal command bar.
- Primary actions use solid blue.
- Secondary actions use white buttons with grey borders.
- Dialogs are sharp, compact, and form-first.

### Alternative Considered: Dark Sidebar Dashboard

The previous dashboard specification used a dark enterprise sidebar and larger KPI cards. It remains useful for analytics-heavy views, but it does not match the provided product screenshots closely enough for product, tariff, and quotation creation workflows.

### Alternative Considered: Spacious SaaS Minimal

This would use more whitespace and softer cards. It is calmer, but less efficient for dense product and quotation operations.

## Color System

### Primary

| Token | Hex | Usage |
| --- | --- | --- |
| `primary` | `#2563D8` | Search, new item, active states |
| `primary-600` | `#1F55C8` | Hover and stronger text links |
| `primary-soft` | `#EAF1FF` | Active navigation and selected hints |

### Neutral

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#F5F6F8` | Main app background |
| `surface` | `#FFFFFF` | Tables, panels, modals |
| `surface-soft` | `#F3F5F8` | Table headers |
| `border` | `#D9DEE8` | Inputs, tables, buttons |
| `border-soft` | `#E8ECF2` | Sidebar and thumbnails |
| `text` | `#151B26` | Main content |
| `muted` | `#8792A5` | Placeholders, table headers, metadata |

### Status

| Token | Hex | Usage |
| --- | --- | --- |
| `success` | `#16A34A` | Completed, positive values |
| `warning` | `#D97706` | Draft or caution |
| `danger` | `#FF4D4F` | Delete actions and errors |
| `info` | `#0891B2` | Informational indicators |

## Typography

```css
font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
```

| Role | Size | Line height | Weight | Usage |
| --- | --- | --- | --- | --- |
| Page title | `16px` | `24px` | `700` | Admin page title, matching screenshot scale |
| Modal title | `20px` | `28px` | `700` | Add/edit forms |
| Section title | `16px` | `24px` | `700` | Panels and form sections |
| Body/table | `14px` | `20px` | `400` | Table cells and inputs |
| Helper | `13px` | `18px` | `400` | Counts, metadata, product chip details |
| Table header | `12px` | `16px` | `700` | Column labels |

## Spacing, Radius, Shadow

Spacing follows a 4px grid.

| Token | Value | Usage |
| --- | --- | --- |
| `space-1` | `4px` | Tight internal gaps |
| `space-2` | `8px` | Button and chip gaps |
| `space-3` | `12px` | Compact form gaps |
| `space-4` | `16px` | Toolbar and panel gaps |
| `space-5` | `20px` | Panel padding |
| `space-6` | `24px` | Page-level breathing room |
| `space-8` | `32px` | Empty states |

| Token | Value | Usage |
| --- | --- | --- |
| `radius-sm` | `2px` | Inputs, buttons, thumbnails |
| `radius-md` | `6px` | Tables and panels |
| `radius-lg` | `8px` | Dashboard cards |
| `radius-full` | `999px` | Badges and switches |

| Token | Value | Usage |
| --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.04)` | Rare subtle elevation |
| `shadow-md` | `0 12px 28px rgba(15, 23, 42, 0.10)` | Modals only |

## Core Components

### Search Command Bar

Search sits on the left, primary and secondary actions on the right.

```css
.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.search-group {
  display: flex;
  gap: 10px;
  min-width: min(440px, 100%);
}
```

### Buttons

Primary actions are solid blue. Secondary actions are flat white buttons with grey borders.

```css
.primary-action {
  min-height: 36px;
  padding: 0 16px;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

button,
.file-action {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
```

### Tables

Tables are the dominant data surface. They use grey headers, generous row height, and thin separators.

```css
th,
td {
  border-bottom: 1px solid var(--color-border);
  padding: 18px 16px;
  font-size: 14px;
  white-space: nowrap;
}

th {
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}
```

### Inputs

Inputs are rectangular, 36px high, and use a blue focus ring.

```css
input,
select {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
}

input:focus,
select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 216, 0.12);
}
```

### Modal Forms

Add/edit forms use a compact two-column grid. Product image URL gets a visual thumbnail placeholder.

```css
.modal {
  width: min(672px, 100%);
  border: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: var(--shadow-md);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}
```

### Product Picker

Quotation generation uses searchable product chips before the selected item table.

```css
.product-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.product-chip {
  min-height: 44px;
  display: inline-grid;
  grid-auto-flow: column;
  grid-template-columns: auto auto auto;
}
```

## CSS Variables

```css
:root {
  --color-primary: #2563d8;
  --color-primary-600: #1f55c8;
  --color-primary-soft: #eaf1ff;
  --color-secondary: #111827;
  --color-bg: #f5f6f8;
  --color-surface: #ffffff;
  --color-surface-soft: #f3f5f8;
  --color-border: #d9dee8;
  --color-border-soft: #e8ecf2;
  --color-text: #151b26;
  --color-muted: #8792a5;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #ff4d4f;
  --color-info: #0891b2;
  --radius-sm: 2px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 12px 28px rgba(15, 23, 42, 0.10);
}
```

## Tailwind Token Mapping

```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563D8',
          600: '#1F55C8',
          soft: '#EAF1FF',
        },
        background: '#F5F6F8',
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F3F5F8',
        },
        border: {
          DEFAULT: '#D9DEE8',
          soft: '#E8ECF2',
        },
        text: '#151B26',
        muted: '#8792A5',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#FF4D4F',
        info: '#0891B2',
      },
      borderRadius: {
        sm: '2px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
        md: '0 12px 28px rgba(15, 23, 42, 0.10)',
      },
    },
  },
};
```
