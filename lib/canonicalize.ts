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

function getValueByPath(input: unknown, path: string): unknown {
    if (!path) return input;

    const tokens = path.split(".").filter(Boolean);

    const getProp = (obj: unknown, prop: string): unknown => {
        if (!obj || typeof obj !== "object") return undefined;
        return (obj as Record<string, unknown>)[prop];
    };

    const visit = (node: unknown, index: number): unknown => {
        if (index >= tokens.length) return node;
        const token = tokens[index] ?? "";

        const isWildcard = token.endsWith("[*]");
        const key = isWildcard ? token.slice(0, -3) : token;
        const next = key ? getProp(node, key) : node;

        if (isWildcard) {
            if (!Array.isArray(next)) return undefined;
            for (const item of next) {
                const v = visit(item, index + 1);
                if (v !== undefined && v !== null) return v;
            }
            return undefined;
        }

        if (Array.isArray(next)) {
            return next.length > 0 ? visit(next[0], index + 1) : undefined;
        }

        if (next === undefined) return undefined;
        return visit(next, index + 1);
    };

    return visit(input, 0);
}

function coerceValue(value: unknown, dataType: string): unknown {
    const dt = (dataType || "").toLowerCase();

    if (dt.includes("bool")) {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        if (typeof value === "string") {
            const v = value.trim().toLowerCase();
            if (["true", "1", "yes", "y"].includes(v)) return true;
            if (["false", "0", "no", "n"].includes(v)) return false;
        }
        return undefined;
    }

    if (dt.includes("date") || dt.includes("time")) {
        if (value instanceof Date) return value;
        if (typeof value === "number") {
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? undefined : d;
        }
        if (typeof value === "string") {
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? undefined : d;
        }
        return undefined;
    }

    if (dt.includes("int") || dt.includes("float") || dt.includes("number") || dt.includes("decimal")) {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
            const normalized = value.replace(/[,\s]/g, "");
            const n = Number(normalized);
            return Number.isFinite(n) ? n : undefined;
        }
        return undefined;
    }

    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return undefined;
}
