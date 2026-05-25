import { IsString, MinLength } from 'class-validator';

export class RejectBillboardDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
