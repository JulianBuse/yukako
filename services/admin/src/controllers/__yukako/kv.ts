import { NextFunction, Request, Response, Router } from 'express';
import {
    handleThrownError,
    respond,
} from '../../middleware/error-handling/throwable';
import {
    KvDeleteResponse,
    KvGetParams,
    KvGetResponse,
    KvResponse,
    KvPutResponse,
    KvPutParams,
    KvDeleteParams,
    KvListParams,
    KvListResponse,
} from '@yukako/types';
import { parseParams } from '../../lib/parse-params';
import { getDatabase } from '@yukako/state';
import { kvEntry } from '@yukako/state/src/db/schema';
import { and, desc, eq, like, lt, not, sql } from 'drizzle-orm';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';

const internalKvRouter = Router();

internalKvRouter.get('/:kvId', async (req, res) => {
    try {
        const kvid = req.params.kvId;
        const params = parseParams<KvGetParams>(req);

        const db = getDatabase();

        const keys = params.keys;

        const entries = await db
            .select({
                key: kvEntry.key,
                value: kvEntry.value,
            })
            .from(kvEntry)
            .where(
                and(eq(kvEntry.kvDatabaseId, kvid), inArray(kvEntry.key, keys)),
            );

        // console.log(entries);

        const result: KvResponse<KvGetResponse> = {
            type: 'result',
            result: {
                values: Object.fromEntries(
                    keys.map((key) => {
                        const entry = entries.find(
                            (_entry) => _entry.key === key,
                        );
                        const value = entry ? entry.value : null;

                        return [key, value];
                    }),
                ),
            },
        };

        // console.log('result', result);

        respond.status(200).message(result).throw();
    } catch (err) {
        respond.rethrow(err);

        let message = 'Internal Server Error';

        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }

        respond.status(500).message({ type: 'error', error: message }).throw();
    }
});

internalKvRouter.get('/:kvId/list', async (req) => {
    try {
        const kvid = req.params.kvId;
        const params = parseParams<KvListParams>(req);

        const db = getDatabase();

        const limit = parseInt(params.limit, 10);
        const cursor = params.cursor;
        const prefix = params.prefix;
        const suffix = params.suffix;
        const includes = params.includes;
        const excludes = params.excludes;

        const prefixLike = prefix ? `${prefix}%` : null;
        const suffixLike = suffix ? `%${suffix}` : null;
        const includesLike = includes ? `%${includes}%` : null;
        const excludesLike = excludes ? `%${excludes}%` : null;

        const conditions = [];

        if (cursor) {
            conditions.push(
                lt(kvEntry.updatedAt, new Date(parseInt(cursor, 10))),
            );
        }

        if (prefixLike) {
            conditions.push(like(kvEntry.key, prefixLike));
        }

        if (suffixLike) {
            conditions.push(like(kvEntry.key, suffixLike));
        }

        if (includesLike) {
            conditions.push(like(kvEntry.key, includesLike));
        }

        if (excludesLike) {
            conditions.push(not(like(kvEntry.key, excludesLike)));
        }

        const entries = await db
            .select({ key: kvEntry.key, updatedAt: kvEntry.updatedAt })
            .from(kvEntry)
            .where(and(eq(kvEntry.kvDatabaseId, kvid), ...conditions))
            .limit(limit)
            .orderBy(desc(kvEntry.updatedAt));

        const cursorEntry = entries[entries.length - 1];
        const cursorValue = cursorEntry
            ? cursorEntry.updatedAt.getTime()
            : null;

        const value: KvResponse<KvListResponse> = {
            type: 'result',
            result: {
                list: entries.map((entry) => ({
                    key: entry.key,
                })),
                cursor: cursorValue,
            },
        };

        respond.status(200).message(value).throw();
    } catch (err) {
        respond.rethrow(err);

        let message = 'Internal Server Error';

        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }

        respond.status(500).message({ type: 'error', error: message }).throw();
    }
});

internalKvRouter.put('/:kvId', async (req, res) => {
    // const kvid = req.params.kvId;
    // const params = parseParams<KvPutParams>(req);
    //
    // // console.log('kvRouter.put /:kvId', kvid, Object.fromEntries(params.list));
    //
    // const result: KvResponse<KvPutResponse> = {
    //     type: 'result',
    //     result: {
    //         success: true,
    //     },
    // };
    //
    // respond.status(200).message(result).throw();
    try {
        const kvid = req.params.kvId;
        const params = parseParams<KvPutParams>(req);

        const db = getDatabase();

        const result = await db.$primary.transaction(async (txn) => {
            let insertEntries: { key: string; value: string }[] = [];
            let deleteEntries: string[] = [];

            for (const [key, value] of params.list) {
                if (value === null) {
                    deleteEntries.push(key);
                } else {
                    insertEntries.push({ key, value });
                }
            }

            let deleteResult = false;
            let updateResult = false;

            try {
                if (deleteEntries.length > 0) {
                    const _deleteResult = await txn
                        .delete(kvEntry)
                        .where(
                            and(
                                eq(kvEntry.kvDatabaseId, kvid),
                                inArray(kvEntry.key, deleteEntries),
                            ),
                        );

                    deleteResult = true;
                } else {
                    deleteResult = true;
                }

                if (insertEntries.length > 0) {
                    const _updateResult = await txn
                        .insert(kvEntry)
                        .values(
                            insertEntries.map((entry) => ({
                                ...entry,
                                kvDatabaseId: kvid,
                                updatedAt: new Date(),
                            })),
                        )
                        .onConflictDoUpdate({
                            target: [kvEntry.key, kvEntry.kvDatabaseId],
                            set: {
                                key: sql`excluded.key`,
                                value: sql`excluded.value`,
                                updatedAt: sql`excluded.updated_at`,
                                kvDatabaseId: sql`excluded.kv_database_id`,
                            },
                        });

                    updateResult = true;
                } else {
                    updateResult = true;
                }
            } catch (err) {
                console.error(err);
            }

            return { deleteResult, updateResult };
        });

        if (result.deleteResult && result.updateResult) {
            const result: KvResponse<KvPutResponse> = {
                type: 'result',
                result: {
                    success: true,
                },
            };

            respond.status(200).message(result).throw();
        } else {
            respond
                .status(500)
                .message({ type: 'error', error: 'Internal Server Error' })
                .throw();
        }
    } catch (err) {
        respond.rethrow(err);

        let message = 'Internal Server Error';

        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }

        respond.status(500).message({ type: 'error', error: message }).throw();
    }
});

internalKvRouter.delete('/:kvId', async (req, res) => {
    // const kvid = req.params.kvId;
    // const params = parseParams<KvDeleteParams>(req);
    //
    // // console.log('kvRouter.delete /:kvId', kvid, params.keys);
    //
    // const result: KvResponse<KvDeleteResponse> = {
    //     type: 'result',
    //     result: {
    //         success: true,
    //     },
    // };
    //
    // respond.status(200).message(result).throw();

    try {
        const kvid = req.params.kvId;
        const params = parseParams<KvDeleteParams>(req);

        const db = getDatabase();

        const result = await db.$primary.transaction(async (txn) => {
            const deleteResult = await txn
                .delete(kvEntry)
                .where(
                    and(
                        eq(kvEntry.kvDatabaseId, kvid),
                        inArray(kvEntry.key, params.keys),
                    ),
                );

            return true;
        });

        if (result) {
            const result: KvResponse<KvDeleteResponse> = {
                type: 'result',
                result: {
                    success: true,
                },
            };

            respond.status(200).message(result).throw();
        } else {
            respond
                .status(500)
                .message({ type: 'error', error: 'Internal Server Error' })
                .throw();
        }
    } catch (err) {
        respond.rethrow(err);

        let message = 'Internal Server Error';

        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }

        respond.status(500).message({ type: 'error', error: message }).throw();
    }
});

internalKvRouter.use(handleThrownError);
internalKvRouter.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) => {
        let message = 'Internal Server Error';

        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }

        res.status(500).send({ type: 'error', error: message });
    },
);

export default internalKvRouter;
