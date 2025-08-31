import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { CredentialService } from './credential.service';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { TalentCredential } from './schema/credential.schema';

async function bootstrap() {
  // Create a NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get services needed for test
  const credentialService = app.get(CredentialService);
  const credentialModel = app.get(getModelToken(TalentCredential.name));

  try {
    console.log('Starting blockchain credential minting test...');

    // Find a credential that's ready to be minted
    const pendingCredential = await credentialModel.findOne({
      blockchainStatus: { $nin: ['MINTED', 'MINTING_FAILED'] },
      verificationStatus: 'VERIFIED',
    });

    if (!pendingCredential) {
      console.log('No pending credentials found. Create a verified credential first.');
      await app.close();
      return;
    }

    console.log(`Found credential to test: ${pendingCredential._id}`);

    // Find the user associated with this credential
    const userModel = app.get('UserModel'); // Adjust this to match how your user model is registered
    const user = await userModel.findById(pendingCredential.userId || pendingCredential.user);
    
    if (!user) {
      console.log('User not found for credential. Cannot test minting.');
      await app.close();
      return;
    }

    // Test minting the credential
    console.log('Starting blockchain minting process...');
    const result = await credentialService.testMintCredential(pendingCredential, user);
    
    console.log('Minting result:', result);
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
