import { Test, TestingModule } from '@nestjs/testing';
import { CompanyModuleController } from './company-module.controller';

describe('CompanyModuleController', () => {
  let controller: CompanyModuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyModuleController],
    }).compile();

    controller = module.get<CompanyModuleController>(CompanyModuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
