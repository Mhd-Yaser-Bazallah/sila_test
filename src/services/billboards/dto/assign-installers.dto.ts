import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignInstallersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  installerIds: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
