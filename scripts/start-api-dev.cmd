@echo off
cd /d E:\code\codex\quotation
"D:\Program Files\nodejs\node.exe" "E:\code\codex\quotation\node_modules\tsx\dist\cli.mjs" watch --tsconfig "E:\code\codex\quotation\server\tsconfig.json" "E:\code\codex\quotation\server\main.ts" > E:\code\codex\quotation\.api-dev.out.log 2> E:\code\codex\quotation\.api-dev.err.log
