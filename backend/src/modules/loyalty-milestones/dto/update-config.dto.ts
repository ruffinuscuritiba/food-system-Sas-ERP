import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class UpdateLoyaltyMilestoneConfigDto {
  @IsInt()
  @Min(2)
  @Max(100)
  ordersThreshold!: number;

  @IsString()
  @MaxLength(100)
  rewardLabel!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
