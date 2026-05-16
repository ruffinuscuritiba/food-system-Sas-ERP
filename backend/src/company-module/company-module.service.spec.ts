import { Test, TestingModule } from '@nestjs/testing';
import { CompanyModuleService } from './company-module.service';

describe('CompanyModuleService', () => {
  let service: CompanyModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanyModuleService],
    }).compile();

    service = module.get<CompanyModuleService>(CompanyModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
