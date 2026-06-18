# EdgeOne Pages Deployment

This project includes the EdgeOne Pages MCP deployment tool:

```bash
npm run edgeone:deploy
```

The script uses Tencent Cloud China:

```bash
edgeone-pages-mcp-fullstack --region china
```

## Required Account Setup

Before deploying, create an EdgeOne Pages API token:

```text
EDGEONE_PAGES_API_TOKEN
```

Optionally set the target project name:

```text
EDGEONE_PAGES_PROJECT_NAME
```

For local PowerShell:

```powershell
$env:EDGEONE_PAGES_API_TOKEN="your-token"
$env:EDGEONE_PAGES_PROJECT_NAME="quotation"
npm run edgeone:deploy
```

## Recommended Build Settings

For the React/Vite frontend:

```text
Build command: npm run build
Output directory: dist/client
```

This repository also contains a NestJS backend and local/Excel-style data workflows. For production use with mostly mainland China users, deploy the static frontend to EdgeOne Pages and host the API/data layer on a China-region backend service or database-backed server.
