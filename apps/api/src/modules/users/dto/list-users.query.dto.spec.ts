import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './list-users.query.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ListUsersQueryDto, payload));

describe('ListUsersQueryDto', () => {
  it('accepts an empty payload', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it('coerces pagination and accepts a role key', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      page: '2',
      limit: '25',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      role: 'ADMIN',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
    expect(dto.role).toBe('ADMIN');
  });

  it('rejects a non-string role', async () => {
    const errors = await check({ role: 42 });
    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });
});
