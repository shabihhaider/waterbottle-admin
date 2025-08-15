// frontend/src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Pick the route you want as the landing page:
  redirect("/dashboard"); // or "/customers"
}
