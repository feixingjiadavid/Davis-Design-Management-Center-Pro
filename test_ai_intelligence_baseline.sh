#!/usr/bin/env bash
set -euo pipefail

rg -q 'ai-designer-workspace\.html' js/auth.js
rg -q 'id="req-link"' index.html
rg -q 'test_tasks' js/index.js
rg -q 'uat-ai-design' ai-designer-workspace.html
rg -q 'davis\.design\.ai' ai-designer-workspace.html
