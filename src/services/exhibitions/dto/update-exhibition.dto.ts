import {
  ExhibitionAboutCardInput,
  ExhibitionParticipationFeatureInput,
  ExhibitionSectorInput,
} from './create-exhibition.dto';
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

export class UpdateExhibitionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  secondaryHeroImageUrl?: string;

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
