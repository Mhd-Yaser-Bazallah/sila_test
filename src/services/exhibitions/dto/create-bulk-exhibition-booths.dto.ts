import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateExhibitionBoothDto } from './create-exhibition-booth.dto';

export class CreateBulkExhibitionBoothsDto {
  @Type(() => CreateExhibitionBoothDto)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  booths: CreateExhibitionBoothDto[];
}
