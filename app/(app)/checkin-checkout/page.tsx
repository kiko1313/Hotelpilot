import { redirect } from "next/navigation";

export default function CheckInCheckOutRedirect() {
  // Check-in/check-out happens directly from the Reservations list.
  redirect("/reservations");
}
