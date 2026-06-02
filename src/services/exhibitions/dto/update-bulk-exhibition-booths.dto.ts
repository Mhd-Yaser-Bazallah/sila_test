import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateExhibitionBoothDto } from './update-exhibition-booth.dto';

export class UpdateBulkExhibitionBoothItemDto extends UpdateExhibitionBoothDto {
  @IsString()
  id: string;
}

export class UpdateBulkExhibitionBoothsDto {
  @Type(() => UpdateBulkExhibitionBoothItemDto)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  booths: UpdateBulkExhibitionBoothItemDto[];
}
