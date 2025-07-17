import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OrganizationPost,
  OrganizationPostSchema,
} from './schema/organization-post.schema';
import { OrganizationPostController } from './organization-post.controller';
import { OrganizationPostService } from './organization-post.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationPost.name, schema: OrganizationPostSchema },
    ]),
  ],
  controllers: [OrganizationPostController],
  providers: [OrganizationPostService],
  exports: [OrganizationPostService],
})
export class OrganizationPostModule {}
