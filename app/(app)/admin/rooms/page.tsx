import { redirect } from "next/navigation";

export default function AdminRoomsRedirect() {
  redirect("/rooms/management");
}
