"use server";

import { createClient } from "@/lib/supabase/server";
import { checkOutStay, recordPayment } from "@/lib/actions/stays";
import { setEmployeeStatus } from "@/lib/actions/employees";

export type PendingAction =
  | { type: "check_out_stay"; stayId: string; summary: string }
  | { type: "record_payment"; stayId: string; amount: number; summary: string }
  | { type: "disable_employee"; employeeId: string; summary: string };

export type AskAIResult =
  | { ok: true; answer: string; pendingAction?: PendingAction }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Read-only tools — broad operational scope per the ops-agent spec
// ---------------------------------------------------------------------------
const READ_TOOLS = [
  {
    name: "get_dashboard_summary",
    description: "Current occupancy: how many rooms occupied/available/reserved, today's arrivals and checkouts, total outstanding balance.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_rooms",
    description: "List all rooms with their current status (AVAILABLE, OCCUPIED, RESERVED) and price.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_active_and_reserved_stays",
    description: "List all currently active (checked-in) and reserved (upcoming) stays, with guest, room, dates, total, paid, balance.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_outstanding_balances",
    description: "List only stays with money still owed (balance > 0).",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_todays_payments",
    description: "List all payments recorded today.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "search_guest",
    description: "Search for a guest by name and return their info and stay history.",
    properties: { name: { type: "string", description: "Guest name or partial name" } },
    required: ["name"],
  },
  {
    name: "get_current_shift",
    description: "Info about the currently open shift: who's responsible, when it started.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_staff_list",
    description: "List all employees: name, staff ID, role, active/disabled status.",
    properties: {},
    required: [] as string[],
  },
  {
    name: "get_recent_audit_log",
    description: "Recent audit log entries — who did what, when. Use this for questions about staff activity, suspicious activity, or 'what happened' questions.",
    properties: { limit: { type: "number", description: "Max entries to return, default 30" } },
    required: [] as string[],
  },
  {
    name: "get_shift_discrepancies",
    description: "Room verification discrepancies reported during shifts (rooms expected empty but reported otherwise).",
    properties: {},
    required: [] as string[],
  },
] as const;

// ---------------------------------------------------------------------------
// Action tools — these NEVER execute directly. Calling one produces a
// proposal that the admin must explicitly confirm via confirmAgentAction().
// ---------------------------------------------------------------------------
const ACTION_TOOLS = [
  {
    name: "propose_check_out",
    description: "Propose checking out the active stay in a given room. Does NOT execute — only proposes, pending admin confirmation.",
    properties: { room_number: { type: "string", description: "Room number, e.g. '7'" } },
    required: ["room_number"],
  },
  {
    name: "propose_record_payment",
    description: "Propose recording a payment for the active/reserved stay in a given room. Does NOT execute — only proposes, pending admin confirmation.",
    properties: {
      room_number: { type: "string", description: "Room number, e.g. '7'" },
      amount: { type: "number", description: "Payment amount" },
    },
    required: ["room_number", "amount"],
  },
  {
    name: "propose_disable_employee",
    description: "Propose disabling a staff account (e.g. in response to suspicious activity). Does NOT execute — only proposes, pending admin confirmation.",
    properties: {
      login_id: { type: "string", description: "The staff member's login ID" },
      reason: { type: "string", description: "Why this is being proposed" },
    },
    required: ["login_id", "reason"],
  },
] as const;

const ACTION_TOOL_NAMES = new Set<string>(ACTION_TOOLS.map((t) => t.name));

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function runReadTool(supabase: SupabaseClient, name: string, input: Record<string, unknown>) {
  switch (name) {
    case "get_dashboard_summary": {
      const { data: rooms } = await supabase.from("rooms").select("status");
      const { data: stays } = await supabase
        .from("stays_with_details")
        .select("status, arrival_at, current_checkout_at, balance")
        .in("status", ["ACTIVE", "RESERVED"]);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      const occupied = rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
      const available = rooms?.filter((r) => r.status === "AVAILABLE").length ?? 0;
      const reserved = rooms?.filter((r) => r.status === "RESERVED").length ?? 0;
      const arrivalsToday = (stays ?? []).filter(
        (s) => s.status === "RESERVED" && new Date(s.arrival_at) >= todayStart && new Date(s.arrival_at) < todayEnd
      ).length;
      const checkoutsToday = (stays ?? []).filter(
        (s) => s.status === "ACTIVE" && new Date(s.current_checkout_at) >= todayStart && new Date(s.current_checkout_at) < todayEnd
      ).length;
      const outstanding = (stays ?? []).reduce((sum, s) => sum + Number(s.balance ?? 0), 0);
      return { occupied, available, reserved, arrivalsToday, checkoutsToday, outstanding };
    }
    case "get_rooms": {
      const { data } = await supabase.from("rooms").select("room_number, status, price").order("room_number");
      return data;
    }
    case "get_active_and_reserved_stays": {
      const { data } = await supabase
        .from("stays_with_details")
        .select("guest_name, room_number, status, arrival_at, check_in_at, current_checkout_at, total_amount, amount_paid, balance")
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
    case "get_staff_list": {
      const { data } = await supabase
        .from("employees")
        .select("full_name, login_id, role, status")
        .order("full_name");
      return data;
    }
    case "get_recent_audit_log": {
      const limit = (input.limit as number) || 30;
      const { data } = await supabase
        .from("audit_logs")
        .select("action, object_type, reason, created_at, employees(full_name, login_id)")
        .order("created_at", { ascending: false })
        .limit(limit);
      return data;
    }
    case "get_shift_discrepancies": {
      const { data } = await supabase
        .from("shift_room_checks")
        .select("note, checked_at, rooms(room_number), employees(full_name)")
        .eq("is_discrepancy", true)
        .order("checked_at", { ascending: false })
        .limit(30);
      return data;
    }
    default:
      return { error: "Unknown tool" };
  }
}

/** Resolves an action-tool call into a PendingAction, or an error string. */
async function resolveProposal(
  supabase: SupabaseClient,
  name: string,
  input: Record<string, unknown>
): Promise<PendingAction | { error: string }> {
  switch (name) {
    case "propose_check_out": {
      const roomNumber = String(input.room_number ?? "");
      const { data: stay } = await supabase
        .from("stays_with_details")
        .select("id, guest_name, balance")
        .eq("room_number", roomNumber)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (!stay) return { error: `No active stay found in room ${roomNumber}.` };
      return {
        type: "check_out_stay",
        stayId: stay.id,
        summary: `Check out ${stay.guest_name} from room ${roomNumber}${Number(stay.balance) > 0 ? ` (balance owed: ${stay.balance})` : ""}.`,
      };
    }
    case "propose_record_payment": {
      const roomNumber = String(input.room_number ?? "");
      const amount = Number(input.amount);
      const { data: stay } = await supabase
        .from("stays_with_details")
        .select("id, guest_name")
        .eq("room_number", roomNumber)
        .in("status", ["ACTIVE", "RESERVED"])
        .maybeSingle();
      if (!stay) return { error: `No active or reserved stay found in room ${roomNumber}.` };
      return {
        type: "record_payment",
        stayId: stay.id,
        amount,
        summary: `Record a payment of ${amount} for ${stay.guest_name}, room ${roomNumber}.`,
      };
    }
    case "propose_disable_employee": {
      const loginId = String(input.login_id ?? "");
      const reason = String(input.reason ?? "");
      const { data: employee } = await supabase
        .from("employees")
        .select("id, full_name, status")
        .eq("login_id", loginId.toUpperCase())
        .maybeSingle();
      if (!employee) return { error: `No staff member found with ID ${loginId}.` };
      if (employee.status === "disabled") return { error: `${employee.full_name} is already disabled.` };
      return {
        type: "disable_employee",
        employeeId: employee.id,
        summary: `Disable staff account for ${employee.full_name} (${loginId}). Reason: ${reason}`,
      };
    }
    default:
      return { error: "Unknown action" };
  }
}

function buildSystemPrompt(fullName: string) {
  return `You are HotelPilot's Operations Assistant — a practical tool for the hotel's Master Admin, not a generic chatbot.
The person asking is ${fullName}, Master Admin.

Rules you always follow:
- Use ONLY the tools provided. Never invent hotel data.
- You are READ-ONLY by default. If the admin asks you to change something (check someone out, record a payment, disable an account), call the matching "propose_*" tool — this only proposes the action, it does not execute it. The admin must confirm separately. Never claim an action was completed unless you called a propose_* tool and the system confirms it was executed.
- If a request is ambiguous, ask ONE short clarifying question — don't guess, but don't over-ask either.
- Answer concisely, in plain language. Use the hotel's actual currency as it appears in the data.
- If something looks unusual (repeated discrepancies, unusual account activity, large balances), report it factually — say "please verify this," never accuse anyone of wrongdoing.
- If a tool returns no data, say so plainly.`;
}

async function askDeepSeek(
  supabase: SupabaseClient,
  apiKey: string,
  model: string,
  systemPrompt: string,
  question: string
): Promise<AskAIResult> {
  const tools = [...READ_TOOLS, ...ACTION_TOOLS].map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: "object", properties: t.properties, required: t.required },
    },
  }));

  type ChatMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    tool_call_id?: string;
  };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  for (let round = 0; round < 4; round++) {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools, max_tokens: 1024 }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 200);
      } catch {
        // ignore
      }
      console.error("AI provider error", response.status, detail);
      return { ok: false, error: `AI service error (${response.status}). ${detail || "Try again shortly."}` };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message?.tool_calls || message.tool_calls.length === 0) {
      return { ok: true, answer: message?.content ?? "No answer." };
    }

    // If the model proposed a write action, stop here — resolve it into a
    // concrete proposal and return it for the admin to confirm. Never
    // execute automatically.
    const actionCall = message.tool_calls.find((c: { function: { name: string } }) =>
      ACTION_TOOL_NAMES.has(c.function.name)
    );
    if (actionCall) {
      const input = actionCall.function.arguments ? JSON.parse(actionCall.function.arguments) : {};
      const resolved = await resolveProposal(supabase, actionCall.function.name, input);
      if ("error" in resolved) {
        return { ok: true, answer: resolved.error };
      }
      return { ok: true, answer: resolved.summary, pendingAction: resolved };
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    for (const call of message.tool_calls) {
      const input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      const result = await runReadTool(supabase, call.function.name, input);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { ok: false, error: "Took too many steps to answer. Try a simpler question." };
}

export async function askHotelPilotAI(question: string): Promise<AskAIResult> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "deepseek-v4-flash";

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
  if (employee.role !== "master_admin") {
    return { ok: false, error: "The Operations Assistant is available to the Master Admin only." };
  }

  try {
    return await askDeepSeek(supabase, apiKey, model, buildSystemPrompt(employee.full_name), question);
  } catch (e) {
    console.error("AI assistant error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: `Could not reach the AI service: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Executes a confirmed action — only reachable after the admin explicitly
// clicks "Confirm" on a proposal. Reuses the same audited action functions
// as the rest of the app, so nothing bypasses the normal audit trail.
// ---------------------------------------------------------------------------
export async function confirmAgentAction(action: PendingAction): Promise<AskAIResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();
  if (employee?.role !== "master_admin") {
    return { ok: false, error: "Only the Master Admin can confirm actions." };
  }

  try {
    switch (action.type) {
      case "check_out_stay": {
        const result = await checkOutStay(action.stayId);
        return result.ok
          ? { ok: true, answer: "Done — checked out. This was recorded in the audit log." }
          : { ok: false, error: result.error };
      }
      case "record_payment": {
        const fd = new FormData();
        fd.set("stay_id", action.stayId);
        fd.set("amount", String(action.amount));
        fd.set("note", "Recorded via Operations Assistant");
        const result = await recordPayment(fd);
        return result.ok
          ? { ok: true, answer: "Done — payment recorded. This was recorded in the audit log." }
          : { ok: false, error: result.error };
      }
      case "disable_employee": {
        const result = await setEmployeeStatus(action.employeeId, "disabled");
        return result.ok
          ? { ok: true, answer: "Done — account disabled. This was recorded in the audit log." }
          : { ok: false, error: result.error };
      }
      default:
        return { ok: false, error: "Unknown action type." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not execute the action." };
  }
}
