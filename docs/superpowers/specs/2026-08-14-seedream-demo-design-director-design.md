# Seedream Demo + Design Director Workflow

## Goal
Replace the low-quality Cloudflare Demo stage with Seedream 4.0 and feed Seedream a design-director-grade prompt that combines requirement understanding, page purpose, visual-reference analysis, required brand assets, exact copy, hierarchy, composition and hard constraints.

## Architecture
- DeepSeek remains the requirement-understanding brain.
- Qwen Vision remains the visual-reference analysis layer.
- Seedream 4.0 becomes the Demo image generator as well as the final image generator.
- Demo generation passes the primary style reference plus required design assets to the existing Seedream proxy as multi-reference images.
- Demo output is a complete designed page, not a Cloudflare background plus deterministic SVG text overlay.
- Existing final-generation flow stays intact.

## Demo Prompt Contract
Each page prompt must include: design goal, audience, page title/purpose, exact copy, visual direction, layout plan, Qwen style analysis, required assets and their identities, hard constraints, visual hierarchy, composition guidance, typography guidance, safe margins, and explicit anti-copy rules for style references.

The prompt must instruct Seedream to preserve provided IP/Logo/person assets, render the supplied page copy rather than inventing content, avoid copying unrelated people/objects/text from style references, produce one complete 1242x1660 page for 小蓝书 unless an explicit size overrides it, and prioritize a polished enterprise campaign visual over PPT/Word-like layout.

## Generation Behavior
- Generate one Demo per `brief.pages` item.
- Use up to 10 image inputs: primary style reference first, then required assets in sort order.
- Old Cloudflare Demo rows must not block a new Seedream Demo; active reuse is scoped to the current Seedream model and prompt version.
- Store provider/model, requested/actual size, page metadata, input-image count, exact copy and prompt version in the generation output.
- If Seedream proxy fails, the task becomes `demo_failed` and surfaces the real error message.

## UI/Status
UAT status text must say Seedream Demo rather than Cloudflare Demo. Existing final-stage naming remains Seedream 4.0.

## Out of Scope
No database migration is required. No automatic paid final retries are added. Final generation remains an explicit post-Demo-confirmation action.
