import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  imageIds: number[];
}
