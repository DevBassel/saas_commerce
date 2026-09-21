import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM = 'isPlatform';
export const Platform = () => SetMetadata(IS_PLATFORM, true);
