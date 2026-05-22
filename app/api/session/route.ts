import { getSessionUser, setSession } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();

  if (user) {
    await setSession(user.id);
  }

  return Response.json({
    user,
  });
}
