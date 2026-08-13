#!/usr/bin/env bash
set -euo pipefail

rg -q 'ingestTaskSources' supabase/functions/uat-ai-design/index.ts
rg -q 'action === "read_sources"' supabase/functions/uat-ai-design/index.ts
rg -q 'source_read_completed' supabase/functions/uat-ai-design/index.ts
rg -q 'analyzeRequirement' supabase/functions/uat-ai-design/index.ts
rg -q 'generateDemo' supabase/functions/uat-ai-design/index.ts
rg -q 'confirmDemo' supabase/functions/uat-ai-design/index.ts
rg -q 'generateFinal' supabase/functions/uat-ai-design/index.ts
if rg -q '企业内部文化活动设计' supabase/functions/uat-ai-design/index.ts; then
  echo 'fixed analysis fallback must be removed' >&2
  exit 1
fi
rg -q 'verify_jwt' test_ai_intelligence_baseline.sh supabase/functions/uat-ai-design/index.ts || true
