import { IsString, MinLength } from 'class-validator';

export class RejectExhibitionDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
