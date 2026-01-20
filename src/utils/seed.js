require('dotenv').config();
const connectDB = require('../config/database');
const connectionManager = require('../database/connectionManager');
const { getPlatformAdminModel } = require('../platform/models/PlatformAdmin');
const clientDatabaseService = require('../services/clientDatabaseService');
const moment = require('moment');

/**
 * Seed Script
 * Initializes platform admin and optionally creates sample client database
 * Run with: node src/utils/seed.js
 */

async function seed() {
  try {
    // Connect to database
    await connectDB();

    console.log('Starting seed process...');

    // Create platform super admin
    const PlatformAdmin = getPlatformAdminModel();
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@bookacut.com';
    const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeThisPassword123!';

    let platformAdmin = await PlatformAdmin.findOne({ email: adminEmail });

    if (!platformAdmin) {
      platformAdmin = await PlatformAdmin.create({
        email: adminEmail,
        password: adminPassword,
        phone: '0000000000',
        firstName: 'Platform',
        lastName: 'Admin',
        isActive: true,
      });
      console.log('✓ Created platform super admin user');
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: ${adminPassword}`);
      console.log('  ⚠️  Please change the password after first login!');
    } else {
      console.log('✓ Platform super admin user already exists');
    }

    // Create a sample client database for testing (optional)
    const createSampleClient = process.env.CREATE_SAMPLE_CLIENT === 'true';

    if (createSampleClient) {
      try {
        const { getClientAdminModel } = require('../platform/models/ClientAdmin');
        const ClientAdmin = getClientAdminModel();

        let sampleClient = await ClientAdmin.findOne({ email: 'sample@client.com' });

        if (!sampleClient) {
          // Create sample client database
          const result = await clientDatabaseService.createClientDatabase({
            email: 'sample@client.com',
            firstName: 'Sample',
            lastName: 'Client',
            phone: '1234567890',
            password: 'SamplePassword123!',
            maxShops: 5,
            maxStaff: 20,
            subscriptionPlan: 'premium',
            subscriptionExpiresAt: moment().add(30, 'days').toDate(),
          });

          console.log('✓ Created sample client database');
          console.log(`  Client ID: ${result.clientId}`);
          console.log(`  Database: ${result.databaseName}`);
          console.log(`  Email: ${result.clientAdmin.email}`);
          console.log(`  Password: SamplePassword123!`);
        } else {
          console.log('✓ Sample client already exists');
        }
      } catch (error) {
        console.error('Error creating sample client:', error.message);
      }
    }

    console.log('\n✓ Seed process completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Login with platform admin credentials');
    console.log('3. Create your first client admin');
    console.log('4. Client databases will be created automatically');

    process.exit(0);
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
