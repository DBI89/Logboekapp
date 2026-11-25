"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE } from "./sessie";

export async function wisselGebruiker(gebruikerId: string) {
  (await cookies()).set(COOKIE, gebruikerId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
