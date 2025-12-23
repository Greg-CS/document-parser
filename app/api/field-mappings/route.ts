import prisma from "@/lib/prisma-node";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;

    if (
      !body ||
      typeof body !== "object" ||
      !("sourceType" in body) ||
      !("mappings" in body)
    ) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { sourceType, mappings } = body as {
      sourceType?: unknown;
      mappings?: unknown;
    };

    if (typeof sourceType !== "string" || !Array.isArray(mappings)) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const normalized = mappings
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const rec = m as Record<string, unknown>;
        const sourceField = typeof rec.sourceField === "string" ? rec.sourceField : null;
        const targetField = typeof rec.targetField === "string" ? rec.targetField : null;
        if (!sourceField || !targetField) return null;
        return { sourceField, targetField };
      })
      .filter((m): m is { sourceField: string; targetField: string } => Boolean(m));

    if (normalized.length === 0) {
      return Response.json({ error: "No valid mappings provided" }, { status: 400 });
    }

    const targetNames = Array.from(new Set(normalized.map((m) => m.targetField)));
    const canonicalFields = await prisma.canonicalField.findMany({
      where: { name: { in: targetNames } },
      select: { id: true, name: true },
    });

    const canonicalByName = new Map(canonicalFields.map((cf) => [cf.name, cf.id] as const));
    const missing = targetNames.filter((name) => !canonicalByName.has(name));
    if (missing.length > 0) {
      return Response.json(
        { error: `Unknown canonical field(s): ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(
      normalized.map((m) =>
        prisma.fieldMapping.upsert({
          where: {
            sourceType_sourceField_targetField: {
              sourceType,
              sourceField: m.sourceField,
              targetField: m.targetField,
            },
          },
          update: {
            canonicalFieldId: canonicalByName.get(m.targetField) ?? null,
          },
          create: {
            sourceType,
            sourceField: m.sourceField,
            targetField: m.targetField,
            canonicalFieldId: canonicalByName.get(m.targetField) ?? null,
          },
        })
      )
    );

    return Response.json({ saved: created.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save mappings";
    return Response.json({ error: message }, { status: 500 });
  }
}
