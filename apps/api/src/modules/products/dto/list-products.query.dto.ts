import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';

/**
 * `GET /products` is public and historically returns a plain array. When a
 * client sends `page`/`limit` (the Refine admin console does), the endpoint
 * returns a paginated envelope instead.
 */
export class ListProductsQueryDto extends PaginationQueryDto {}
