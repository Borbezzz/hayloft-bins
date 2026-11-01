import { cookies } from "next/headers";
import { PASS_COOKIE, WHO_COOKIE, passToken } from "@/lib/auth";
import { isPerson } from "@/lib/people";
import { heartbeat, leave } from "@/lib/store";

async function whoAmI() {
  const c = await cookies();
  if (c.get(PASS_COOKIE)?.value !== passToken()) return null;
  const who = c.get(WHO_COOKIE)?.value;
  return isPerson(who) ? who : null;
}

export async function POST(req: Request) {
  const who = await whoAmI();
  if (!who) return Response.json({ online: [] }, { status: 401 });
  if (new URL(req.url).searchParams.has("bye")) {
    await leave(who);
    return new Response(null, { status: 204 });
  }
  return Response.json({ online: await heartbeat(who) });
}

export async function DELETE() {
  const who = await whoAmI();
  if (who) await leave(who);
  return new Response(null, { status: 204 });
}
