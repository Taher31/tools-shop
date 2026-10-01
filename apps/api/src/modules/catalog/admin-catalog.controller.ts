import { Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  type AdminBrandView,
  type AdminCategoryView,
  type AdminProductDetail,
  type AdminProductListItem,
  type AdminProductListQuery,
  adminProductListQuerySchema,
  type AttributeUpsertInput,
  attributeUpsertSchema,
  type AttributeView,
  type BrandUpsertInput,
  brandUpsertSchema,
  type CategoryAttributesInput,
  categoryAttributesSchema,
  type CategoryUpsertInput,
  categoryUpsertSchema,
  type Paginated,
  type ProductUpsertInput,
  productUpsertSchema,
  type VariantPriceUpdateInput,
  variantPriceUpdateSchema,
} from '@toolshop/shared';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AttributesService } from './attributes.service';
import { BrandsService } from './brands.service';
import { CategoriesService } from './categories.service';
import { AdminProductsService } from './products/admin-products.service';

@AdminController('categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions('category.read')
  tree(): Promise<AdminCategoryView[]> {
    return this.categories.adminTree();
  }

  @Get(':id/effective-attributes')
  @RequirePermissions('product.read')
  effectiveAttributes(@UuidParam() id: string) {
    return this.categories.effectiveAttributes(id);
  }

  @Post()
  @RequirePermissions('category.create')
  create(@ZBody(categoryUpsertSchema) input: CategoryUpsertInput): Promise<AdminCategoryView> {
    return this.categories.create(input);
  }

  @Put(':id')
  @RequirePermissions('category.update')
  update(@UuidParam() id: string, @ZBody(categoryUpsertSchema) input: CategoryUpsertInput): Promise<AdminCategoryView> {
    return this.categories.update(id, input);
  }

  @Put(':id/attributes')
  @RequirePermissions('category.update', 'attribute.read')
  setAttributes(
    @UuidParam() id: string,
    @ZBody(categoryAttributesSchema) input: CategoryAttributesInput,
  ): Promise<AdminCategoryView> {
    return this.categories.setAttributes(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('category.delete')
  remove(@UuidParam() id: string): Promise<void> {
    return this.categories.remove(id);
  }
}

@AdminController('brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermissions('brand.read')
  list(): Promise<AdminBrandView[]> {
    return this.brands.adminList();
  }

  @Post()
  @RequirePermissions('brand.create')
  create(@ZBody(brandUpsertSchema) input: BrandUpsertInput): Promise<AdminBrandView> {
    return this.brands.create(input);
  }

  @Put(':id')
  @RequirePermissions('brand.update')
  update(@UuidParam() id: string, @ZBody(brandUpsertSchema) input: BrandUpsertInput): Promise<AdminBrandView> {
    return this.brands.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('brand.delete')
  remove(@UuidParam() id: string): Promise<void> {
    return this.brands.remove(id);
  }
}

@AdminController('attributes')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  @RequirePermissions('attribute.read')
  list() {
    return this.attributes.list();
  }

  @Post()
  @RequirePermissions('attribute.create')
  create(@ZBody(attributeUpsertSchema) input: AttributeUpsertInput): Promise<AttributeView> {
    return this.attributes.create(input);
  }

  @Put(':id')
  @RequirePermissions('attribute.update')
  update(@UuidParam() id: string, @ZBody(attributeUpsertSchema) input: AttributeUpsertInput): Promise<AttributeView> {
    return this.attributes.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('attribute.delete')
  remove(@UuidParam() id: string): Promise<void> {
    return this.attributes.remove(id);
  }
}

@AdminController('products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  @RequirePermissions('product.read')
  list(@ZQuery(adminProductListQuerySchema) query: AdminProductListQuery): Promise<Paginated<AdminProductListItem>> {
    return this.products.list(query);
  }

  @Get(':id')
  @RequirePermissions('product.read')
  get(@UuidParam() id: string): Promise<AdminProductDetail> {
    return this.products.get(id);
  }

  @Post()
  @RequirePermissions('product.create')
  create(@ZBody(productUpsertSchema) input: ProductUpsertInput): Promise<AdminProductDetail> {
    return this.products.create(input);
  }

  @Put(':id')
  @RequirePermissions('product.update')
  update(
    @UuidParam() id: string,
    @ZBody(productUpsertSchema) input: ProductUpsertInput,
    @CurrentUser() actor: AuthContext,
  ): Promise<AdminProductDetail> {
    return this.products.update(id, input, actor);
  }

  @Put('variants/:variantId/price')
  @RequirePermissions('product.price.update')
  updatePrice(
    @UuidParam('variantId') variantId: string,
    @ZBody(variantPriceUpdateSchema) input: VariantPriceUpdateInput,
  ): Promise<AdminProductDetail> {
    return this.products.updateVariantPrice(variantId, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('product.delete')
  remove(@UuidParam() id: string): Promise<void> {
    return this.products.remove(id);
  }
}
