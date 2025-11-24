import { Test, TestingModule } from '@nestjs/testing';
import { FitbitController } from './fitbit.controller';
import { FitbitService } from './fitbit.service';

describe('FitbitController', () => {
  let controller: FitbitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FitbitController],
      providers: [FitbitService],
    }).compile();

    controller = module.get<FitbitController>(FitbitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
