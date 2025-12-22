import { CanonicalField, FieldMapping } from "@prisma/client";

type CanonicalizeInput = {
    parsedData: unknown;
    mappings: Array<FieldMapping & { canonicalField: CanonicalField }>;
};

export function canonicalize({
    parsedData,
    mappings,
}: CanonicalizeInput): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
        const rawValue = getValueByPath(parsedData, mapping.sourceField);
        if (rawValue === undefined || rawValue === null) continue;

        const coerced = coerceValue(rawValue, mapping.canonicalField.dataType);
        if (coerced === undefined) continue;

        result[mapping.canonicalField.name] = coerced;
    }

    return result;
}
