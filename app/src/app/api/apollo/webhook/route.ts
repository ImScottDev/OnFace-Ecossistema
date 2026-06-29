import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/apollo/webhook — receive waterfall enrichment results (phone/email)
export async function POST(request: NextRequest) {
  // Apollo sends waterfall results here asynchronously
  // No auth needed — this is a webhook endpoint called by Apollo
  try {
    const body = await request.json();
    console.log("Apollo webhook received:", JSON.stringify(body).slice(0, 500));

    const person = body?.person;
    if (!person?.id) {
      return NextResponse.json({ ok: true, message: "No person data" });
    }

    // Find lead by apolloId
    const [lead] = await db
      .select({ id: leads.id, telefone: leads.telefone, email: leads.email })
      .from(leads)
      .where(eq(leads.apolloId, person.id))
      .limit(1);

    if (!lead) {
      console.log(`Apollo webhook: no lead found for apolloId ${person.id}`);
      return NextResponse.json({ ok: true, message: "Lead not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    // Update phone if we got one
    if (person.phone_numbers?.length && !lead.telefone) {
      updates.telefone = person.phone_numbers[0].raw_number;
    }

    // Update email if we got one
    if (person.email && !lead.email) {
      updates.email = person.email;
    }

    // Update personal emails if revealed
    if (person.personal_emails?.length && !lead.email) {
      updates.email = person.personal_emails[0];
    }

    if (Object.keys(updates).length > 1) {
      await db.update(leads).set(updates).where(eq(leads.id, lead.id));
      console.log(`Apollo webhook: updated lead ${lead.id} with waterfall data`);
    }

    return NextResponse.json({ ok: true, updated: lead.id });
  } catch (error) {
    console.error("Apollo webhook error:", error);
    return NextResponse.json({ ok: true, error: String(error) });
  }
}
