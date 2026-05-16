import { Test, TestingModule } from '@nestjs/testing';
import { TableOrdersService } from './table-orders.service';

describe('TableOrdersService', () => {
  let service: TableOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TableOrdersService],
    }).compile();

    service = module.get<TableOrdersService>(TableOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
