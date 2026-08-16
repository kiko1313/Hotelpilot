"use server";

import { createClient } from "@/lib/supabase/server";

export type AskAIResult = { ok: true; answer: string } | { ok: false; error: string };

const TOOLS = [
  {
    name: "get_rooms",
    description: "List all rooms with their current status (AVAILABLE, OCCUPIED, RESERVED) and price.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_active_and_reserved_stays",
    description:
      "List all currently active (checked-in) and reserved (upcoming, not yet checked in) stays, with guest name, room, arrival/checkout dates, total, paid, and balance owed.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_outstanding_balances",
    description: "List only stays that currently have money owed (balance > 0), with guest name and amount owed.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_todays_payments",
    description: "List all payments recorded today, with guest, amount, and time.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "search_guest",
    description: "Search for a guest by name and return their info and stay history.",
    input_schema: {
      type: "object" as const,
      properties: { name: { type: "string", description: "Guest name or partial name to search for" } },
      required: ["name"],
    },
  },
  {
    name: "get_current_shift",
    description: "Get info about the currently open shift, if any: who's responsible, when it started, and its activity so far.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

async function runTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  input: Record<string, unknown>
) {
  switch (name) {
    case "get_rooms": {
      const { data } = await supabase
        .from("rooms")
        .select("room_number, status, price")
        .order("room_number");
      return data;
    }
    case "get_active_and_reserved_stays": {
      const { data } = await supabase
        .from("stays_with_details")
        .select(
          "guest_name, room_number, status, arrival_at, check_in_at, current_checkout_at, total_amount, amount_paid, balance"
        )
        .in("status", ["ACTIVE", "RESERVED"]);
      return data;
    }
    case "get_outstanding_balances": {
      const { data } = await supabase
        .from("stays_with_details")
        .select("guest_name, room_number, balance, status")
        .gt("balance", 0)
        .in("status", ["ACTIVE", "RESERVED"]);
      return data;
    }
    case "get_todays_payments": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("payments")
        .select("amount, paid_at, stays(guests(full_name))")
        .gte("paid_at", start.toISOString());
      return data;
    }
    case "search_guest": {
      const name = (input.name as string) ?? "";
      const { data: guests } = await supabase
        .from("guests")
        .select("id, full_name, phone, email")
        .ilike("full_name", `%${name}%`)
        .limit(5);
      if (!guests || guests.length === 0) return { found: false };
      const guestIds = guests.map((g) => g.id);
      const { data: stays } = await supabase
        .from("stays_with_details")
        .select("guest_name, room_number, status, arrival_at, current_checkout_at, balance")
        .in("guest_id", guestIds);
      return { guests, stays };
    }
    case "get_current_shift": {
      const { data: shift } = await supabase
        .from("shifts")
        .select("slot, started_at, employees:responsible_employee_id(full_name)")
        .eq("status", "OPEN")
        .maybeSingle();
      return shift ?? { open: false };
    }
    default:
      return { error: "Unknown tool" };
  }
}

export async function askHotelPilotAI(question: string): Promise<AskAIResult> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "claude-sonnet-4-6";

  if (!apiKey) {
    return { ok: false, error: "AI is not configured yet. Set AI_API_KEY in your deployment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: employee } = await supabase
    .from("employees")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!employee) return { ok: false, error: "Employee profile not found." };

  const systemPrompt = `You are HotelPilot AI, an assistant for a small hotel's front-desk staff.
You answer questions using ONLY the tools provided — you never invent hotel data.
The person asking is ${employee.full_name}, role: ${employee.role}.
Answer concisely, in plain language a receptionist would use. Use euro (€) for money.
If a tool returns no data, say so plainly rather than guessing.
If something looks unusual (e.g. many discrepancies, large outstanding balances), mention it factually without accusing any employee of wrongdoing — just say "please verify this."`;

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: question },
  ];

  try {
    for (let round = 0; round < 4; round++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          tools: TOOLS,
          messages,
        }),
      });

      if (!response.ok) {
        return { ok: false, error: "AI service error. Try again shortly." };
      }

      const data = await response.json();
      const content = data.content as Array<Record<string, unknown>>;

      const toolUses = content.filter((c) => c.type === "tool_use");

      if (toolUses.length === 0) {
        const textBlock = content.find((c) => c.type === "text");
        return { ok: true, answer: (textBlock?.text as string) ?? "No answer." };
      }

      messages.push({ role: "assistant", content });

      const toolResults = await Promise.all(
        toolUses.map(async (tu) => {
          const result = await runTool(
            supabase,
            tu.name as string,
            (tu.input as Record<string, unknown>) ?? {}
          );
          return {
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
    }

    return { ok: false, error: "Took too many steps to answer. Try a simpler question." };
  } catch {
    return { ok: false, error: "Could not reach the AI service." };
  }
}
