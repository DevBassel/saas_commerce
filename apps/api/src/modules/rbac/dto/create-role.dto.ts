import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message:
      'key must start with a lowercase letter and contain only lowercase letters, digits, underscores or hyphens',
  })
  key: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
