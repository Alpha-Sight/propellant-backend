import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  CreateJobPostDto,
  GetAllJobPostsDto,
  UpdateJobPostDto,
} from './dto/organization-post.dto';
import {
  OrganizationPost,
  OrganizationPostDocument,
} from './schema/organization-post.schema';
import { RepositoryService } from '../repository/repository.service';
import { UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class OrganizationPostService {
  constructor(
    @InjectModel(OrganizationPost.name)
    private organizationPostModel: Model<OrganizationPostDocument>,
    private repositoryService: RepositoryService,
  ) {}

  async createJobPost(
    organization: UserDocument,
    payload: CreateJobPostDto,
  ): Promise<OrganizationPost> {
    return await this.organizationPostModel.create({
      organization: organization._id,
      ...payload,
    });
  }

  async getAllJobPosts(query: GetAllJobPostsDto) {
    const {
      jobType,
      location,
      status,
      visibility,
      searchQuery,
      ...paginationQuery
    } = query;

    let search: FilterQuery<OrganizationPostDocument> = {};
    if (searchQuery) {
      search = {
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { location: { $regex: searchQuery, $options: 'i' } },
        ],
      };
    }

    const filters: FilterQuery<OrganizationPostDocument> = {
      ...(jobType && { jobType }),
      ...(location && { location }),
      ...(status && { status }),
      ...(visibility !== undefined && { visibility }),
      ...search,
    };

    return this.repositoryService.paginate<OrganizationPostDocument>({
      model: this.organizationPostModel,
      query: {
        ...paginationQuery,
      },
      options: filters,
    });
  }

  async getOrganizationJobPosts(
    organization: UserDocument,
    query: GetAllJobPostsDto,
  ) {
    const {
      jobType,
      location,
      status,
      visibility,
      searchQuery,
      ...paginationQuery
    } = query;

    return await this.repositoryService.paginate<OrganizationPostDocument>({
      model: this.organizationPostModel,
      query: paginationQuery,
      options: {
        organization: organization._id,
        isDeleted: { $ne: true },
        ...(jobType && { jobType }),
        ...(status && { status }),
        ...(visibility !== undefined && { visibility }),
        ...(location && { location: { $regex: location, $options: 'i' } }),
        ...(searchQuery && {
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
          ],
        }),
      },
      populateFields: [{ path: 'organization' }],
    });
  }

  async getJobPostById(postId: string): Promise<OrganizationPostDocument> {
    const jobPost = await this.organizationPostModel
      .findOne({
        _id: postId,
        isDeleted: { $ne: true },
      })
      .populate([{ path: 'organization' }]);

    if (!jobPost) {
      throw new NotFoundException('Job post not found');
    }

    return jobPost;
  }

  async updateJobPostById(
    organization: UserDocument,
    postId: string,
    payload: UpdateJobPostDto,
  ): Promise<OrganizationPostDocument> {
    const updatedJobPost = await this.organizationPostModel.findOneAndUpdate(
      { _id: postId, organization: organization._id, isDeleted: { $ne: true } },
      { $set: payload },
      { new: true, runValidators: true },
    );

    if (!updatedJobPost) {
      throw new NotFoundException(
        'Job post not found or may have been deleted',
      );
    }

    return updatedJobPost;
  }
}
