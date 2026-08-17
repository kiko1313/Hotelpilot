"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Room = { id: string; room_number: string; price: number; status: string };
type Guest = { id: string; full_name: string; phone: string | null };

export function NewBookingForm({
  rooms,
  guests,
  action,
}: {
  rooms: Room[];
  guests: Guest[];
  action: (formData: FormData) => void;
}) {
  const [guestMode, setGuestMode] = useState<"existing" | "new">(
    guests.length > 0 ? "existing" : "new"
  );
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [arrival, setArrival] = useState("");
  const [checkout, setCheckout] = useState("");
  const [roomPrice, setRoomPrice] = useState(rooms[0]?.price ?? 0);

  const nights = useMemo(() => {
    if (!arrival || !checkout) return 0;
    const diff =
      (new Date(checkout).getTime() - new Date(arrival).getTime()) /
      (1000 * 60 * 60 * 24);
    return diff > 0 ? Math.round(diff) : 0;
  }, [arrival, checkout]);

  const total = nights * roomPrice;

  if (rooms.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-warn/40 bg-warn/10 p-6 text-center">
        <p className="mb-3 text-sm text-parchment">
          No rooms have been added yet — a booking needs a room to assign.
        </p>
        <Link
          href="/rooms/management"
          className="inline-block rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright"
        >
          Add rooms first
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mx-auto max-w-lg space-y-5 rounded-2xl border border-ink-700 bg-ink-900 p-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-parchment">
          Guest
        </label>
        <div className="mb-2 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setGuestMode("existing")}
            className={`rounded-full px-3 py-1 ${
              guestMode === "existing"
                ? "bg-brass text-ink-950"
                : "border border-ink-600 text-parchment-dim"
            }`}
          >
            Existing guest
          </button>
          <button
            type="button"
            onClick={() => setGuestMode("new")}
            className={`rounded-full px-3 py-1 ${
              guestMode === "new"
                ? "bg-brass text-ink-950"
                : "border border-ink-600 text-parchment-dim"
            }`}
          >
            + New guest
          </button>
        </div>

        {guestMode === "existing" ? (
          <select
            name="guest_id"
            required
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
          >
            <option value="">Select a guest…</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.full_name} {g.phone ? `— ${g.phone}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <input
              name="new_guest_name"
              placeholder="Full name"
              required
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
            />
            <input
              name="new_guest_phone"
              placeholder="Phone (optional)"
              className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-parchment">
          Room
        </label>
        <select
          name="room_id"
          required
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            const room = rooms.find((r) => r.id === e.target.value);
            if (room) setRoomPrice(room.price);
          }}
          className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
        >
          <option value="" disabled>
            Select a room…
          </option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Room {r.room_number} ({r.status}) — €{r.price}/night
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Arrival
          </label>
          <input
            type="date"
            name="arrival_at"
            required
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Expected checkout
          </label>
          <input
            type="date"
            name="checkout_at"
            required
            value={checkout}
            onChange={(e) => setCheckout(e.target.value)}
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Guests
          </label>
          <input
            type="number"
            name="num_guests"
            min={1}
            defaultValue={1}
            required
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-parchment">
            Room price / night
          </label>
          <input
            type="number"
            name="room_price"
            step="0.01"
            required
            value={roomPrice === 0 ? "" : roomPrice}
            placeholder="0"
            onFocus={(e) => e.target.select()}
            onChange={(e) => setRoomPrice(e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment-dim">
        {nights > 0
          ? `${nights} night${nights === 1 ? "" : "s"} × €${roomPrice} = `
          : "Total: "}
        <span className="font-medium text-parchment">€{total.toFixed(2)}</span>
        <input type="hidden" name="total_amount" value={total} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-parchment">
          Deposit / payment now (optional)
        </label>
        <input
          type="number"
          name="deposit"
          step="0.01"
          min="0"
          defaultValue=""
          placeholder="0"
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-brass focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-parchment">
          Notes
        </label>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-parchment focus:border-brass focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-brass px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-bright"
      >
        Save booking
      </button>
    </form>
  );
}
