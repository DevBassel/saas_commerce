import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ProductPermissionKey } from './constants/product-permissions.enum';
import {
  FALLBACK_MAX_FILE_SIZE,
  MAX_FILES_PER_REQUEST,
} from './constants/upload.constants';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions([ProductPermissionKey.READ])
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Permissions([ProductPermissionKey.READ])
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Permissions([ProductPermissionKey.CREATE])
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @Permissions([ProductPermissionKey.UPDATE])
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Permissions([ProductPermissionKey.DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  @Post(':id/images')
  @Permissions([ProductPermissionKey.UPDATE])
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: {
        fileSize: Number(process.env.MAX_FILE_SIZE) || FALLBACK_MAX_FILE_SIZE,
        files: MAX_FILES_PER_REQUEST,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('files field is required');
    }
    return this.productsService.uploadImages(id, files);
  }

  @Delete(':id/images/:imageId')
  @Permissions([ProductPermissionKey.UPDATE])
  deleteImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    return this.productsService.deleteImage(id, imageId);
  }

  @Patch(':id/images/order')
  @Permissions([ProductPermissionKey.UPDATE])
  reorderImages(
    @Param('id', ParseIntPipe) id: number,
    @Body() reorderImagesDto: ReorderImagesDto,
  ) {
    return this.productsService.reorderImages(id, reorderImagesDto.imageIds);
  }
}
