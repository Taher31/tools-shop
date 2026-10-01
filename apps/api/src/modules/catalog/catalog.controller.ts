import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  BrandSummary,
  CategoryPage,
  CategoryTreeNode,
  CompareResult,
  HomePageData,
  ProductCard,
  ProductDetail,
} from '@toolshop/shared';
import { isUuid } from '../../common/decorators/validated.decorator';
import { Public } from '../auth/decorators';
import { BrandsService } from './brands.service';
import { CategoriesService } from './categories.service';
import { ProductQueryService } from './products/product-query.service';

function idList(raw: string | undefined, max: number): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(isUuid)
    .slice(0, max);
}

@Public()
@Controller()
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly brands: BrandsService,
    private readonly products: ProductQueryService,
  ) {}

  @Get('home')
  home(): Promise<HomePageData> {
    return this.products.home();
  }

  @Get('categories')
  categoryTree(): Promise<CategoryTreeNode[]> {
    return this.categories.publicTree();
  }

  @Get('categories/:slug')
  category(@Param('slug') slug: string): Promise<CategoryPage> {
    return this.categories.publicPage(slug);
  }

  @Get('brands')
  brandList(): Promise<BrandSummary[]> {
    return this.brands.publicList();
  }

  @Get('brands/:slug')
  brand(@Param('slug') slug: string): Promise<BrandSummary> {
    return this.brands.publicBySlug(slug);
  }

  @Get('products/compare')
  compare(@Query('ids') ids: string | undefined): Promise<CompareResult> {
    return this.products.compare(idList(ids, 4));
  }

  @Get('products/by-ids')
  byIds(@Query('ids') ids: string | undefined): Promise<ProductCard[]> {
    return this.products.cardsByIds(idList(ids, 50));
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.products.getDetail(slug);
  }
}
