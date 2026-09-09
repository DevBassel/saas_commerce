import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { RolesType } from '../../common/constants/Roles.enum';
import bcrypt from 'bcrypt';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.findOne({ email: createUserDto.email });
    if (user) throw new BadRequestException('user already exists');

    createUserDto.password = await bcrypt.hash(createUserDto.password, 12);
    return await this.userRepo.save({ ...createUserDto, role: RolesType.USER });
  }

  findAll() {
    return this.userRepo.find();
  }

  findOne({ id, email }: { id?: number; email?: string }) {
    return this.userRepo.findOne({
      where: [{ id }, { email }],
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne({ id });
    if (!user) throw new NotFoundException();
    return this.userRepo.save({ ...user, ...updateUserDto });
  }

  remove(id: number) {
    return this.userRepo.delete({ id });
  }
}
