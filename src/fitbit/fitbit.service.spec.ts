import { Test, TestingModule } from '@nestjs/testing';
import { FitbitService } from './fitbit.service';

describe('FitbitService', () => {
  let service: FitbitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FitbitService],
    }).compile();

    service = module.get<FitbitService>(FitbitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
