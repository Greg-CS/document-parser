import prisma from "@/lib/prisma";
export async function POST(req: Request) {
  const { sourceType, mappings } = await req.json();

  if (!sourceType || !Array.isArray(mappings)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const created = await prisma.$transaction(
    mappings.map((m) =>
      prisma.fieldMapping.upsert({
        where: {
          sourceType_sourceField_canonicalFieldId: {
            sourceType,
            sourceField: m.sourceField,
            canonicalFieldId: m.canonicalFieldId,
          },
        },
        update: {},
        create: {
          sourceType,
          sourceField: m.sourceField,
          canonicalFieldId: m.canonicalFieldId,
        },
      })
    )
  );

  return Response.json({ saved: created.length });
}
