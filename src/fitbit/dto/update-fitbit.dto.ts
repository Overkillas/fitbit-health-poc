import { PartialType } from '@nestjs/mapped-types';
import { CreateFitbitDto } from './create-fitbit.dto';

export class UpdateFitbitDto extends PartialType(CreateFitbitDto) {}
