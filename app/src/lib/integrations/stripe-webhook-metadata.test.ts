import assert from "node:assert/strict";
import test from "node:test";
import { organizationIdFromStripeMetadata } from "./stripe-webhook-metadata";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

test("aceita crm_organization_id UUID recebido na metadata Stripe", () => {
  assert.equal(organizationIdFromStripeMetadata({ metadata: { crm_organization_id: ORGANIZATION_ID } }), ORGANIZATION_ID);
});

test("rejeita metadata ausente, nao estruturada ou com organization id invalido", () => {
  assert.equal(organizationIdFromStripeMetadata({}), null);
  assert.equal(organizationIdFromStripeMetadata({ metadata: "nao-e-objeto" }), null);
  assert.equal(organizationIdFromStripeMetadata({ metadata: { crm_organization_id: "nao-e-uuid" } }), null);
});
