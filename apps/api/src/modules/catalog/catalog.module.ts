import { Module } from '@nestjs/common';
import {
  AdminAttributesController,
  AdminBrandsController,
  AdminCategoriesController,
  AdminProductsController,
} from './admin-catalog.controller';
import { AttributesService } from './attributes.service';
import { BrandsService } from './brands.service';
import { CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { AdminProductsService } from './products/admin-products.service';
import { ProductQueryService } from './products/product-query.service';
import { TaxonomyService } from './taxonomy.service';

@Module({
  controllers: [
    CatalogController,
    AdminCategoriesController,
    AdminBrandsController,
    AdminAttributesController,
    AdminProductsController,
  ],
  providers: [
    TaxonomyService,
    CategoriesService,
    BrandsService,
    AttributesService,
    AdminProductsService,
    ProductQueryService,
  ],
  exports: [
    TaxonomyService,
    ProductQueryService,
    CategoriesService,
    BrandsService,
    AdminProductsService,
  ],
})
export class CatalogModule {}
