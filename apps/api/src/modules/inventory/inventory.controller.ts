import { Get, Post, Put } from '@nestjs/common';
import {
  type InventoryListQuery,
  inventoryListQuerySchema,
  type InventoryRow,
  type Paginated,
  type StockMovementListQuery,
  stockMovementListQuerySchema,
  type StockMovementView,
  type StockOperationInput,
  stockOperationSchema,
  type StockTransferInput,
  stockTransferSchema,
  type WarehouseUpsertInput,
  warehouseUpsertSchema,
  type WarehouseView,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { InventoryService } from './inventory.service';
import { WarehousesService } from './warehouses.service';

@AdminController('inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions('inventory.read')
  list(@ZQuery(inventoryListQuerySchema) query: InventoryListQuery): Promise<Paginated<InventoryRow>> {
    return this.inventory.list(query);
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  movements(@ZQuery(stockMovementListQuerySchema) query: StockMovementListQuery): Promise<Paginated<StockMovementView>> {
    return this.inventory.movements(query);
  }

  @Get('variants/:variantId')
  @RequirePermissions('inventory.read')
  row(@UuidParam('variantId') variantId: string): Promise<InventoryRow> {
    return this.inventory.row(variantId);
  }

  @Post('operations')
  @RequirePermissions('inventory.update')
  operate(@ZBody(stockOperationSchema) input: StockOperationInput, @CurrentUser() user: AuthContext): Promise<InventoryRow> {
    return this.inventory.applyOperation(input, user.userId);
  }

  @Post('transfers')
  @RequirePermissions('inventory.update')
  transfer(@ZBody(stockTransferSchema) input: StockTransferInput, @CurrentUser() user: AuthContext): Promise<InventoryRow> {
    return this.inventory.transfer(input, user.userId);
  }
}

@AdminController('warehouses')
export class AdminWarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermissions('warehouse.read')
  list(): Promise<WarehouseView[]> {
    return this.warehouses.list();
  }

  @Post()
  @RequirePermissions('warehouse.manage')
  create(@ZBody(warehouseUpsertSchema) input: WarehouseUpsertInput): Promise<WarehouseView> {
    return this.warehouses.create(input);
  }

  @Put(':id')
  @RequirePermissions('warehouse.manage')
  update(@UuidParam() id: string, @ZBody(warehouseUpsertSchema) input: WarehouseUpsertInput): Promise<WarehouseView> {
    return this.warehouses.update(id, input);
  }
}
