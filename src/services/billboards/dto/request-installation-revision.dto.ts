import { IsString } from 'class-validator';

export class RequestInstallationRevisionDto {
  @IsString()
  companyNotes: string;
}
