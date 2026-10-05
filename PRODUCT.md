# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js + React + Tailwind CSS + Hono API + Drizzle ORM + PostgreSQL + BullMQ + Redis + NextAuth. ONFACE lives in `github.com/ImScottDev/OnFace-Ecossistema` (single branch `main`), primarily under `app/src/`.

## Users

Primary users are Callface operators working across sales, implementation, customer success, billing, and management. The product must help Kaua and the team run the real business without losing context between lead intake, opportunity, proposal, contract, payment, delivery, customer success, and retention.

Secondary users are administrators and managers who need reliable operational visibility, especially revenue, pipeline, service status, activities, automations, and exceptions that require action.

## Product Purpose

ONFACE is the operational system for Callface's full customer journey: acquisition, lead intake, qualification, opportunity, proposal, acceptance, contract/payment, validated Won, canonical service creation, onboarding or implementation, customer success, expansion, retention, and churn when retention fails.

Success means the team can trust the product to close the critical path with real data: the correct lead becomes a qualified opportunity with context, a functional proposal, a valid acceptance path, the right commercial evidence, a customer, a service, and the correct post-sale workflow.

## Positioning

This is not the legacy CRM with a lighter theme. It is a connected operating system for Callface's commercial and post-sale machine, built around domain truth instead of disconnected pages. The differentiator is preserving business context and evidence across every transition: campaign to lead, lead to opportunity, proposal to revenue, Won to service, service to implementation, and implementation to CS.

## Operating Context

ONFACE replaces the legacy CRM. Every screen lives in the `(produto)` route group; the only legacy surface left in the app is `(enderecos-antigos)`, which redirects old CRM URLs (team bookmarks) to the new screens. The cutover replaces production with ONFACE in one controlled step, after validation on dev.crm.callface.io.

The agreed work order is module by module in the customer journey: Acquisition, Sales, Post-sale/Implementation, CS/Retention, and Platform. The working ritual is to present the module, identify how it is drawn and where data is wrong, wait for Kaua's validation when business decisions are required, refactor front and back, then flip the menu flag.

The local project is `/Users/Scott/Documents/Scott Studio/onface-ux-rebuild`. The validation environment is dev.crm.callface.io, published with `./deploy.sh dev`. Production changes require explicit approval from Kaua.

## Capabilities and Constraints

Core domains: Person is the human identity, Company is the account, Lead is the acquisition process, Opportunity is the negotiation, Service is the economic and operational post-sale unit. A customer can have Callface AI, PABX, and White Label simultaneously. One opportunity represents one service family; multi-family sales create sibling opportunities.

The journey must preserve source, campaign, UTM, creator, owner, timeline, activities, meetings, conversations, proposal history, contract state, payment evidence, service lifecycle, billing status, and customer success context. Billing status is not lifecycle. Past due does not mean churn. Setup, hardware, and usage are not MRR. Current MRR comes from canonical services, not historical contract totals.

Won rules are product-critical. Callface AI normally requires payment. PABX and initial White Label can become Won with signed contract and payment pending. Additional White Label licenses do not always require a new contract. Exceptional financial evidence is controlled, never a verbal shortcut.

Design and implementation must use the existing CRM2 design system. Screens write role tokens and component primitives, not ad hoc numbers: examples include `rounded-card`, `text-corpo`, and semantic background tokens. Do not install UI kits that bring a competing theme system. Use shadcn/Radix-compatible primitives and the local `Cf2*` system.

Definition of done is non-negotiable: the code compiles, the data matches real SQL and top-level KPIs, the create/edit/save/return flow closes, and the screen follows the design system. If a dimension was not verified, say that explicitly instead of reporting it as complete.

Playwright is currently avoided for token/cost reasons. Manual browser validation may still be needed before calling a workflow complete.

## Brand Commitments

The product belongs to Callface and must feel operational, trustworthy, fast, and precise. The current CRM2 visual foundation uses a seaweed palette with vivid green over dark ink, a finished design-system route at `/design`, and components under `app/src/components/crm2/ds/` plus shared UI primitives.

The interface should prioritize scanability, consistency, dense but organized information, and repeated operational use. Expression lives in precise details, not decorative excess.

## Evidence on Hand

Project context exists in `CLAUDE.md`, `HANDOFF.md`, `README.md`, `docs/db/`, migrations, schema, and the CRM2 source tree. Vault context exists in `projetos/callface/produto/crm-handoff-atual.md`, `projetos/callface/produto/crm2-mapa-mestre-produto.md`, and related Callface notes.

Real production-like data is used locally through the dev database refresh process. Some historical reports and claims of completion are evidence to audit, not proof of current behavior. Existing screenshots, Figma references, and old UI do not override current domain rules or the live design system.

## Product Principles

1. Functional truth before visual polish. A beautiful screen that does not close the real workflow is not done.
2. Preserve context across transitions. Every conversion must carry source, evidence, owner, timeline, and commercial meaning forward.
3. Trust real data over mock states. Do not fabricate metrics, statuses, health scores, or proof when the model does not support them.
4. Promote modules incrementally. The legacy and CRM2 surfaces coexist until each module is proven and intentionally switched.
5. Respect domain boundaries. Lead, opportunity, customer, service, billing, lifecycle, automation, and timeline are separate concepts that connect without collapsing into each other.

## Accessibility & Inclusion

The CRM is a dense operational web app and should preserve keyboard reachability, readable contrast, stable focus behavior, responsive layouts, and reduced-motion handling where motion is used. The existing design system includes contrast checks via `npm run ds:contraste`; new UI should keep those checks passing for touched surfaces.
