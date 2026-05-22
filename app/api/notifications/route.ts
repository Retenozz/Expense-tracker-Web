import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type BrowserPushSubscription = {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      subscription?: BrowserPushSubscription;
      enabled?: boolean;
    };

    if (typeof body.enabled === "boolean") {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          notificationEnabled: body.enabled,
        },
      });
    }

    const subscription = body.subscription;

    if (subscription?.endpoint && subscription.keys?.auth && subscription.keys.p256dh) {
      await prisma.pushSubscription.upsert({
        where: {
          endpoint: subscription.endpoint,
        },
        update: {
          userId: user.id,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
        },
        create: {
          userId: user.id,
          endpoint: subscription.endpoint,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
        },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "บันทึกการตั้งค่า notification ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: string;
  };

  if (body.endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: body.endpoint,
        userId: user.id,
      },
    });
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      notificationEnabled: false,
    },
  });

  return Response.json({ ok: true });
}
