import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Param, 
  Body, 
  Query,
  UseGuards, 
  UseInterceptors, 
  UploadedFile,
  ParseUUIDPipe,
  ForbiddenException,
  ClassSerializerInterceptor
  Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { ImageUploadService } from './services/image-upload.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PauseProjectDto } from './dto/pause-project.dto';
import { ResumeProjectDto } from './dto/resume-project.dto';
import { CompleteProjectDto } from './dto/complete-project.dto';
import { SearchProjectsDto } from './dto/search-projects.dto';
import { UploadImageDto, ImageUploadResponseDto } from './dto/upload-image.dto';
import { GetProjectDonationsQueryDto } from './dto/get-project-donations-query.dto';
import { ProjectDonationsResponseDto } from './dto/project-donations-response.dto';
import { GetProjectAnalyticsDto, ProjectAnalyticsResponseDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../../generated/prisma';

interface JwtUser {
  id: string;
  role: UserRole;
}

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(@Query() searchDto?: SearchProjectsDto) {
    return this.projectsService.findAll(searchDto);
  }

  @Get('search/suggestions')
  async getSearchSuggestions(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.projectsService.getSearchSuggestions(query, limit ? Number(limit) : 10);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtUser,
    @Query() query: GetProjectAnalyticsDto,
  ): Promise<ProjectAnalyticsResponseDto> {
    return this.projectsService.getProjectAnalytics(projectId, user.id, user.role, query);
  }

  @Get(':id/status-history')
  getStatusHistory(@Param('id') id: string) {
    return this.projectsService.getStatusHistory(id);
  }

  @Get(':id/donations')
  @UseInterceptors(ClassSerializerInterceptor)
  getProjectDonations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetProjectDonationsQueryDto,
  ): Promise<ProjectDonationsResponseDto> {
    return this.projectsService.getProjectDonations(id, query);
  }

  @Patch(':id/pause')
  @UseGuards(JwtAuthGuard)
  pauseProject(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PauseProjectDto,
  ) {
    return this.projectsService.pauseProject(id, user.id, user.role, dto);
  }

  @Patch(':id/resume')
  @UseGuards(JwtAuthGuard)
  resumeProject(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ResumeProjectDto,
  ) {
    return this.projectsService.resumeProject(id, user.id, user.role, dto);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeProject(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CompleteProjectDto,
  ) {
    return this.projectsService.completeProject(id, user.id, user.role, dto);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImageDto,
  ): Promise<ImageUploadResponseDto> {
    try {
      // Verify user owns the project or is admin
      const project = await this.projectsService.findOne(projectId);
      if (project.creatorId !== user.id && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('You can only upload images to your own projects');
      }

      const image = await this.imageUploadService.uploadImage(projectId, file, dto.altText);
      
      return {
        success: true,
        message: 'Image uploaded successfully',
        image: {
          id: image.id,
          url: image.url,
          altText: image.altText,
          fileSize: image.fileSize,
          mimeType: image.mimeType,
          fileName: image.fileName,
          createdAt: image.createdAt,
          updatedAt: image.updatedAt,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to upload image',
      };
    }
  }

  @Get(':id/images')
  async getProjectImages(@Param('id', ParseUUIDPipe) projectId: string) {
    return this.imageUploadService.getProjectImages(projectId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  async deleteImage(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: JwtUser,
  ) {
    // Verify user owns the project or is admin
    const project = await this.projectsService.findOne(projectId);
    if (project.creatorId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete images from your own projects');
    }

    await this.imageUploadService.deleteImage(projectId, imageId);
    return { success: true, message: 'Image deleted successfully' };
  }
}
