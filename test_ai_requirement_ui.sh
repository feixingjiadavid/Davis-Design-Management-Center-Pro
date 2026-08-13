#!/usr/bin/env bash
set -euo pipefail

rg -q '资料读取' ai-designer-workspace.html
rg -q 'AI 如何理解需求' ai-designer-workspace.html
rg -q '需要补充的问题' ai-designer-workspace.html
rg -q '确认需求理解' js/task-detail-requester.js
rg -q 'Demo 版本' ai-designer-workspace.html
rg -q 'Seedream 4\.0' ai-designer-workspace.html js/task-detail-requester.js
rg -q 'authorization_required' js/ai-requirement-client.js
rg -q 'idempotency_key' js/ai-requirement-client.js
