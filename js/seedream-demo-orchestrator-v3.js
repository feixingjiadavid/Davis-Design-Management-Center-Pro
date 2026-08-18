import { bootstrapSeedreamDemoOrchestratorV5 } from './seedream-demo-orchestrator-v5.js?v=seedream-demo-dbqueue-v5';

// Legacy compatibility shim. Old cached supabase-config versions may still import this file.
// Always delegate to the single database-driven v5 controller.
export function bootstrapSeedreamDemoOrchestratorV3(client){
  return bootstrapSeedreamDemoOrchestratorV5(client);
}
