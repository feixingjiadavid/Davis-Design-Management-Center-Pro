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
rg -q 'uat_source_snapshots!uat_source_snapshots_source_id_fkey' js/ai-requirement-client.js
rg -q '需求理解大脑：DeepSeek' ai-designer-workspace.html
rg -q 'visual-reference-ui\.js' supabase-config.js
rg -q '视觉参考 / 风格参考' js/visual-reference-ui.js
rg -q 'waiting_visual_reference' js/ai-requirement-client.js js/visual-reference-ui.js supabase/functions/uat-ai-design/index.ts
rg -q 'Demo 01' js/visual-reference-ui.js
rg -q 'generateDemoSet' supabase/functions/uat-ai-design/index.ts supabase/functions/uat-ai-design/generation-service.ts
rg -q 'input_image_\$\{index\}' supabase/functions/uat-ai-design/demo-client.ts
rg -q 'requirement-grounded-v5' supabase/functions/uat-ai-design/requirement-prompt.ts
