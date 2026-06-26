import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ExhibitionAboutCardInput {
  @IsString()
  title: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class ExhibitionSectorInput {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  bullets?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class ExhibitionParticipationFeatureInput {
  @IsString()
  title: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateExhibitionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  visitorCount?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  participantCount?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  participationDays?: number;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  startsAt?: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @Type(() => ExhibitionAboutCardInput)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  aboutCards?: ExhibitionAboutCardInput[];

  @Type(() => ExhibitionSectorInput)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  sectors?: ExhibitionSectorInput[];

  @Type(() => ExhibitionParticipationFeatureInput)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  participationFeatures?: ExhibitionParticipationFeatureInput[];
}

export {
  ExhibitionAboutCardInput,
  ExhibitionParticipationFeatureInput,
  ExhibitionSectorInput,
};
