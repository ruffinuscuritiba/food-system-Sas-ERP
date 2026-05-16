import { Test, TestingModule } from '@nestjs/testing';
import { TableOrdersController } from './table-orders.controller';

describe('TableOrdersController', () => {
  let controller: TableOrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TableOrdersController],
    }).compile();

    controller = module.get<TableOrdersController>(TableOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
