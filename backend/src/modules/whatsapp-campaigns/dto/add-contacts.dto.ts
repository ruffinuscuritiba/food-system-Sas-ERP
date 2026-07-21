import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ContactEntryDto {
  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  name?: string;
}

export class AddContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ContactEntryDto)
  contacts!: ContactEntryDto[];
}
