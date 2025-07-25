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
import { BaseRepositoryService } from '../repository/base.service';
import { UserService } from '../user/services/user.service';
import { UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class OrganizationPostService extends BaseRepositoryService<OrganizationPostDocument> {
  constructor(
    @InjectModel(OrganizationPost.name)
    private organizationPostModel: Model<OrganizationPostDocument>,
    private repositoryService: RepositoryService,
    private userService: UserService,
  ) {
    super(organizationPostModel);
  }

  async createJobPost(
    organization: UserDocument,
    payload: CreateJobPostDto,
  ): Promise<OrganizationPostDocument> {
    const jobPost = await this.organizationPostModel.create({
      organization: organization._id,
      ...payload,
    });

    await this.userService.update(organization._id.toString(), {
      $inc: {
        totalJobPost: 1,
        activeJobPost: 1,
      },
    });
    return jobPost;
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
    const existingJobPost = await this.organizationPostModel.findOne({
      _id: postId,
      organization: organization._id,
      isDeleted: { $ne: true },
    });

    if (!existingJobPost) {
      throw new NotFoundException(
        'Job post not found or may have been deleted',
      );
    }

    const updatedJobPost = await this.organizationPostModel.findByIdAndUpdate(
      postId,
      { $set: payload },
      { new: true, runValidators: true },
    );

    if (existingJobPost.isActive && payload.isActive === false) {
      await this.userService.update(organization._id.toString(), {
        $inc: { activeJobPost: -1 },
      });
    }

    return updatedJobPost;
  }

  async deleteJobPost(postId: string, organizationId: string) {
    const deletedPost = await this.organizationPostModel.findOneAndUpdate(
      {
        _id: postId,
        organization: organizationId,
        isDeleted: { $ne: true },
      },
      { isDeleted: true },
      { new: true },
    );

    if (!deletedPost) {
      throw new NotFoundException('Job post not found or already deleted');
    }

    // Decrement totalJobPosts count
    await this.userService.update(organizationId, {
      $inc: { totalJobPosts: -1 },
    });

    return {
      message: 'Job post deleted successfully',
      // data: deletedPost,
    };
  }

  async toggleJobPostActivation(postId: string, organizationId: string) {
    const jobPost = await this.organizationPostModel.findOne({
      _id: postId,
      organization: organizationId,
      isDeleted: { $ne: true },
    });

    if (!jobPost) {
      throw new NotFoundException('Job post not found');
    }

    jobPost.isActive = !jobPost.isActive;
    await jobPost.save();

    return {
      message: `Job post has been ${jobPost.isActive ? 'activated' : 'inactivated'} successfully`,
      // data: jobPost,
    };
  }

  async getJobPostStats(organizationId: string) {
    const [total, activePosts, inactivePosts] = await Promise.all([
      this.organizationPostModel.countDocuments({
        organization: organizationId,
        isDeleted: { $ne: true },
      }),
      this.organizationPostModel.countDocuments({
        organization: organizationId,
        isDeleted: { $ne: true },
        isActive: true,
      }),
      this.organizationPostModel.countDocuments({
        organization: organizationId,
        isDeleted: { $ne: true },
        isActive: false,
      }),
    ]);

    return { total, activePosts, inactivePosts };
  }

  async getMatchingTalentsForJob(jobPostId: string): Promise<UserDocument[]> {
    const jobPost = await this.organizationPostModel.findById(jobPostId);

    if (!jobPost) {
      throw new NotFoundException('Job post not found');
    }

    const jobSkills = jobPost.requiredSkills;

    return this.userService.getUserBySkills(jobSkills);
  }
}
