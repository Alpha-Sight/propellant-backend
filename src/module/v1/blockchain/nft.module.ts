import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NftService } from './services/nft.service';
import { RelayerModule } from './relayer.module';

@Module({
  imports: [
    ConfigModule,
    RelayerModule,
  ],
  providers: [NftService],
  exports: [NftService],
})
export class NftModule {}
