import { IsBoolean } from 'class-validator';

export class PauseToggleDto {
  @IsBoolean()
  paused: boolean;
}
