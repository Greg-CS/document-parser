/**
 * Database backup script using Prisma
 * This exports all data to JSON files as a backup
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  const backupDir = path.join(__dirname, '..', 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  fs.mkdirSync(backupPath, { recursive: true });

  console.log(`Creating backup at: ${backupPath}`);

  try {
    // Get all model names from Prisma
    const models = Object.keys(prisma).filter(
      key => !key.startsWith('_') && !key.startsWith('$')
    );

    for (const modelName of models) {
      const model = prisma[modelName];
      if (model && typeof model.findMany === 'function') {
        console.log(`Backing up ${modelName}...`);
        const data = await model.findMany();
        const filePath = path.join(backupPath, `${modelName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`  ✓ ${data.length} records backed up`);
      }
    }

    console.log('\n✅ Backup completed successfully!');
    console.log(`Backup location: ${backupPath}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
