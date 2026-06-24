import { PaginationDto } from '../../../shared/common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class QueryExhibitionSectorsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
