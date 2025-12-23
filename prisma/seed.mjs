import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    /**
     * 1. Canonical Fields (Spreadsheet Columns)
     */
    const canonicalFields = [
        {
            name: "accountNumber",
            dataType: "string",
            description: "Primary account identifier"
        },
        {
            name: "accountStatus",
            dataType: "string",
            description: "Current status of the account"
        },
        {
            name: "balance",
            dataType: "decimal",
            description: "Outstanding account balance"
        },
        {
            name: "openedDate",
            dataType: "date",
            description: "Account opening date"
        }
    ]

    for (const field of canonicalFields) {
        await prisma.canonicalField.upsert({
            where: { name: field.name },
            update: {},
            create: field
        })
    }

    /**
     * 2. Provider → Canonical Field Mappings
     */
    const mappings = [
        // Experian
        {
            sourceType: "EXPERIAN",
            sourceField: "acct_num",
            targetField: "accountNumber"
        },
        {
            sourceType: "EXPERIAN",
            sourceField: "status",
            targetField: "accountStatus"
        },
        {
            sourceType: "EXPERIAN",
            sourceField: "balance",
            targetField: "balance"
        },
        {
            sourceType: "EXPERIAN",
            sourceField: "opened",
            targetField: "openedDate"
        },

        // Equifax
        {
            sourceType: "EQUIFAX",
            sourceField: "account_no",
            targetField: "accountNumber"
        },
        {
            sourceType: "EQUIFAX",
            sourceField: "acct_status",
            targetField: "accountStatus"
        },
        {
            sourceType: "EQUIFAX",
            sourceField: "current_balance",
            targetField: "balance"
        },
        {
            sourceType: "EQUIFAX",
            sourceField: "open_date",
            targetField: "openedDate"
        },

        // Array
        {
            sourceType: "ARRAY",
            sourceField: "accountNumber",
            targetField: "accountNumber"
        },
        {
            sourceType: "ARRAY",
            sourceField: "status",
            targetField: "accountStatus"
        },
        {
            sourceType: "ARRAY",
            sourceField: "balance",
            targetField: "balance"
        },
        {
            sourceType: "ARRAY",
            sourceField: "opened_at",
            targetField: "openedDate"
        }
    ]

    for (const mapping of mappings) {
        await prisma.fieldMapping.upsert({
            where: {
                sourceType_sourceField_targetField: {
                    sourceType: mapping.sourceType,
                    sourceField: mapping.sourceField,
                    targetField: mapping.targetField
                }
            },
            update: {},
            create: mapping
        })
    }

    console.log("Seed completed successfully")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
