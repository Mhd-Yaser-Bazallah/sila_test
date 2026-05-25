import { PaginationMeta } from '../../common/types/pagination-meta.type';

export type PrismaQueryArgs = Record<string, unknown>;

interface PrismaDelegate<TEntity> {
  findUnique(args: PrismaQueryArgs): Promise<TEntity | null>;
  findFirst(args?: PrismaQueryArgs): Promise<TEntity | null>;
  findMany(args?: PrismaQueryArgs): Promise<TEntity[]>;
  create(args: PrismaQueryArgs): Promise<TEntity>;
  update(args: PrismaQueryArgs): Promise<TEntity>;
  delete(args: PrismaQueryArgs): Promise<TEntity>;
  count(args?: PrismaQueryArgs): Promise<number>;
}

export interface PaginateArgs extends PrismaQueryArgs {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<TEntity> {
  data: TEntity[];
  meta: PaginationMeta;
}

export abstract class BaseRepository<TEntity> {
  protected constructor(protected readonly delegate: PrismaDelegate<TEntity>) {}

  findUnique(args: PrismaQueryArgs): Promise<TEntity | null> {
    return this.delegate.findUnique(args);
  }

  findFirst(args?: PrismaQueryArgs): Promise<TEntity | null> {
    return this.delegate.findFirst(args);
  }

  findMany(args?: PrismaQueryArgs): Promise<TEntity[]> {
    return this.delegate.findMany(args);
  }

  create(args: PrismaQueryArgs): Promise<TEntity> {
    return this.delegate.create(args);
  }

  update(args: PrismaQueryArgs): Promise<TEntity> {
    return this.delegate.update(args);
  }

  delete(args: PrismaQueryArgs): Promise<TEntity> {
    return this.delegate.delete(args);
  }

  count(args?: PrismaQueryArgs): Promise<number> {
    return this.delegate.count(args);
  }

  async paginate(args: PaginateArgs = {}): Promise<PaginatedResult<TEntity>> {
    const { page = 1, limit = 20, ...queryArgs } = args;
    const skip = (page - 1) * limit;
    const take = limit;
    const countArgs = this.buildCountArgs(queryArgs);

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        ...queryArgs,
        skip,
        take,
      }),
      this.delegate.count(countArgs),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private buildCountArgs(args: PrismaQueryArgs): PrismaQueryArgs {
    return args.where ? { where: args.where } : {};
  }
}
