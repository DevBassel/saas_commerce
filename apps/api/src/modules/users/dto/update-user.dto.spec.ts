import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const body = (): ArgumentMetadata => ({
  type: 'body',
  metatype: UpdateUserDto,
  data: undefined,
});

describe('UpdateUserDto (H3)', () => {
  it('accepts and transforms a name-only payload', async () => {
    const result = (await pipe.transform(
      { name: 'Alice' },
      body(),
    )) as UpdateUserDto;
    expect(result).toBeInstanceOf(UpdateUserDto);
    expect(result).toEqual({ name: 'Alice' });
  });

  it.each(['password', 'jti', 'email', 'roleId'])(
    'rejects the non-whitelisted field %s',
    async (field) => {
      await expect(
        pipe.transform({ name: 'Alice', [field]: 'attack' }, body()),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects a name shorter than 2 characters', async () => {
    await expect(pipe.transform({ name: 'A' }, body())).rejects.toThrow(
      BadRequestException,
    );
  });
});
