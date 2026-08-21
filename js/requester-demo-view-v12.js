// Compatibility entrypoint retained for older UAT HTML shells.
// Requester delivery now uses the same canonical version library as the formal page.
import { bootstrapRequesterFormalDeliveries } from './requester-formal-deliveries.js?v=requester-formal-deliveries-v1';

export function bootstrapRequesterDemoViewV12(supabase) {
  return bootstrapRequesterFormalDeliveries(supabase);
}
