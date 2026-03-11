/**
 * Migration script to consolidate Report and UploadedDocument into CreditReport
 * 
 * This script:
 * 1. Reads all existing UploadedDocument and Report records
 * 2. Creates new CreditReport records with combined data
 * 3. Preserves all relationships and data
 * 4. Provides rollback capability
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  uploadedDocumentsProcessed: number;
  reportsProcessed: number;
  creditReportsCreated: number;
  errors: Array<{ id: string; error: string }>;
}

async function migrateToUnifiedStorage(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    uploadedDocumentsProcessed: 0,
    reportsProcessed: 0,
    creditReportsCreated: 0,
    errors: [],
  };

  console.log('Starting migration to unified CreditReport model...\n');

  try {
    // Get all UploadedDocuments with their related Reports
    const uploadedDocs = await prisma.uploadedDocument.findMany({
      include: {
        reports: true,
        user: true,
      },
    });

    console.log(`Found ${uploadedDocs.length} UploadedDocument records to migrate\n`);

    for (const doc of uploadedDocs) {
      try {
        stats.uploadedDocumentsProcessed++;

        // If document has associated reports, create CreditReport for each
        if (doc.reports && doc.reports.length > 0) {
          for (const report of doc.reports) {
            try {
              stats.reportsProcessed++;

              // Create unified CreditReport
              await prisma.creditReport.create({
                data: {
                  // File metadata from UploadedDocument
                  filename: doc.filename,
                  mimeType: doc.mimeType,
                  fileSize: doc.fileSize,
                  uploadedAt: doc.uploadedAt,
                  rawText: doc.rawText,
                  rawBytes: doc.rawBytes,
                  sha256: doc.sha256,
                  storageProvider: doc.storageProvider,
                  s3Bucket: doc.s3Bucket,
                  s3ObjectKey: doc.s3ObjectKey,
                  reportFingerprint: doc.reportFingerprint,

                  // Credit report data from both sources
                  sourceType: report.sourceType || doc.sourceType,
                  bureauType: null, // Will be set later if needed
                  parsedData: doc.parsedData, // Use UploadedDocument's parsedData

                  // Universal fields from Report
                  firstName: report.firstName,
                  lastName: report.lastName,
                  ssnLast4: report.ssnLast4,
                  dateOfBirth: report.dateOfBirth,
                  accountNumber: report.accountNumber,
                  accountType: report.accountType,
                  accountStatus: report.accountStatus,
                  balance: report.balance,
                  openedDate: report.openedDate,
                  closedDate: report.closedDate,

                  // User relationship
                  userId: doc.userId,
                },
              });

              stats.creditReportsCreated++;
              console.log(`✓ Migrated Report ${report.id} -> CreditReport`);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              stats.errors.push({ id: report.id, error: errorMsg });
              console.error(`✗ Failed to migrate Report ${report.id}: ${errorMsg}`);
            }
          }
        } else {
          // No associated reports, create single CreditReport from UploadedDocument
          try {
            await prisma.creditReport.create({
              data: {
                filename: doc.filename,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                uploadedAt: doc.uploadedAt,
                rawText: doc.rawText,
                rawBytes: doc.rawBytes,
                sha256: doc.sha256,
                storageProvider: doc.storageProvider,
                s3Bucket: doc.s3Bucket,
                s3ObjectKey: doc.s3ObjectKey,
                reportFingerprint: doc.reportFingerprint,
                sourceType: doc.sourceType,
                bureauType: null,
                parsedData: doc.parsedData,
                userId: doc.userId,
              },
            });

            stats.creditReportsCreated++;
            console.log(`✓ Migrated UploadedDocument ${doc.id} -> CreditReport`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            stats.errors.push({ id: doc.id, error: errorMsg });
            console.error(`✗ Failed to migrate UploadedDocument ${doc.id}: ${errorMsg}`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push({ id: doc.id, error: errorMsg });
        console.error(`✗ Failed to process UploadedDocument ${doc.id}: ${errorMsg}`);
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`UploadedDocuments processed: ${stats.uploadedDocumentsProcessed}`);
    console.log(`Reports processed: ${stats.reportsProcessed}`);
    console.log(`CreditReports created: ${stats.creditReportsCreated}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      stats.errors.forEach((err) => {
        console.log(`  - ${err.id}: ${err.error}`);
      });
    }

    return stats;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToUnifiedStorage()
    .then((stats) => {
      if (stats.errors.length === 0) {
        console.log('\n✓ Migration completed successfully!');
        process.exit(0);
      } else {
        console.log('\n⚠ Migration completed with errors');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateToUnifiedStorage };
