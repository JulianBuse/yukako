import { Router, Request } from 'express';
import { getDatabase } from '@yukako/state';
import { authenticate } from '../../lib/authenticate';
import { desc, eq } from 'drizzle-orm';
import {
    dataBlobs,
    projects,
    projectVersionBlobs,
    projectVersionDataBindings,
    projectVersionJsonBindings,
    projectVersionKvDatabaseBinding,
    projectVersionRoutes,
    projectVersions,
    projectVersionTextBindings,
} from '@yukako/state/src/db/schema';
import { respond } from '../../middleware/error-handling/throwable';
import { getSql } from '@yukako/state/src/db/init';
import { z, ZodError } from 'zod';
import { nanoid } from 'nanoid';
import {
    NewProjectVersionRequestBodySchema,
    ProjectVersionsDataResponseBodyType,
} from '@yukako/types';
import { base64Hash } from '@yukako/base64ops';

const projectSpecificVersionsRouter = Router({ mergeParams: true });

type ParentRouterParams = {
    projectId: string;
};

projectSpecificVersionsRouter.get(
    '/',
    async (req: Request<ParentRouterParams>, res) => {
        try {
            const db = getDatabase();

            await authenticate(req);

            let limit = 5;
            let page = 0;

            if (req.query.limit) {
                const parsedLimit = parseInt(req.query.limit as string);
                if (!isNaN(parsedLimit)) {
                    limit = parsedLimit;
                }
            }

            if (req.query.page) {
                const parsedPage = parseInt(req.query.page as string);
                if (!isNaN(parsedPage)) {
                    page = parsedPage;
                }
            }

            const data = await db.query.projectVersions.findMany({
                where: eq(projectVersions.projectId, req.params.projectId),
                orderBy: desc(projectVersions.version),
                with: {
                    projectVersionBlobs: {
                        with: {
                            blob: true,
                        },
                    },
                    routes: true,
                    textBindings: true,
                    jsonBindings: true,
                    dataBindings: true,
                    kvDatabases: true,
                },
                limit,
                offset: page * limit,
            });

            const versions: ProjectVersionsDataResponseBodyType[] = data.map(
                (projectVersion): ProjectVersionsDataResponseBodyType => {
                    const routes = projectVersion.routes.map((route) => ({
                        id: route.id,
                        host: route.host,
                        basePaths: route.basePaths,
                    }));

                    const blobs = projectVersion.projectVersionBlobs.map(
                        (blob) => ({
                            id: blob.blob.id,
                            digest: base64Hash(blob.blob.data),
                            filename: blob.blob.filename,
                            type: blob.blob.type,
                        }),
                    );

                    const textBindings = projectVersion.textBindings.map(
                        (binding) => ({
                            id: binding.id,
                            name: binding.name,
                            value: binding.value,
                        }),
                    );

                    const jsonBindings = projectVersion.jsonBindings.map(
                        (binding) => ({
                            id: binding.id,
                            name: binding.name,
                            value: binding.value,
                        }),
                    );

                    const dataBindings = projectVersion.dataBindings.map(
                        (binding) => ({
                            id: binding.id,
                            name: binding.name,
                            digest: base64Hash(binding.base64),
                        }),
                    );

                    const kvBindings = projectVersion.kvDatabases.map((kv) => ({
                        name: kv.name,
                        kvDatabaseId: kv.kvDatabaseId,
                    }));

                    return {
                        id: projectVersion.id,
                        version: projectVersion.version,
                        projectId: projectVersion.projectId,
                        deployed_at: projectVersion.createdAt.getTime(),
                        routes,
                        blobs,
                        textBindings,
                        jsonBindings,
                        dataBindings,
                        kvBindings,
                    };
                },
            );

            respond.status(200).message(versions).throw();
        } catch (e) {
            respond.rethrow(e);

            respond
                .status(500)
                .message({ error: 'Internal server error' })
                .throw();
        }
    },
);

projectSpecificVersionsRouter.get(
    '/find-by-version/:version',
    async (req: Request<ParentRouterParams & { version: string }>, res) => {
        try {
            const db = getDatabase();
            const _sql = getSql();

            await authenticate(req);

            const version = parseInt(req.params.version);

            if (isNaN(version)) {
                respond
                    .status(400)
                    .message({ error: 'Invalid version' })
                    .throw();
                return;
            }

            const result = await db.query.projects.findFirst({
                where: eq(projects.id, req.params.projectId),
                with: {
                    projectVersions: {
                        where: eq(projectVersions.version, version),
                        with: {
                            projectVersionBlobs: {
                                with: {
                                    blob: true,
                                },
                            },
                            routes: true,
                            textBindings: true,
                            jsonBindings: true,
                            dataBindings: true,
                            kvDatabases: true,
                        },
                    },
                },
            });

            if (!result) {
                respond
                    .status(404)
                    .message({ error: 'Project Not found' })
                    .throw();
                return;
            }

            if (!result.projectVersions[0]) {
                respond
                    .status(404)
                    .message({ error: 'Version Not found' })
                    .throw();
                return;
            }

            const projectVersion = result.projectVersions[0];

            const routes = projectVersion.routes.map((route) => ({
                id: route.id,
                host: route.host,
                basePaths: route.basePaths,
            }));

            const blobs = projectVersion.projectVersionBlobs.map((blob) => ({
                id: blob.blob.id,
                digest: base64Hash(blob.blob.data),
                filename: blob.blob.filename,
                type: blob.blob.type,
            }));

            const textBindings = projectVersion.textBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                value: binding.value,
            }));

            const jsonBindings = projectVersion.jsonBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                value: binding.value,
            }));

            const dataBindings = projectVersion.dataBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                digest: base64Hash(binding.base64),
            }));

            const kvBindings = projectVersion.kvDatabases.map((kv) => ({
                name: kv.name,
                kvDatabaseId: kv.kvDatabaseId,
            }));

            const data: ProjectVersionsDataResponseBodyType = {
                id: projectVersion.id,
                version: projectVersion.version,
                projectId: projectVersion.projectId,
                deployed_at: projectVersion.createdAt.getTime(),
                routes,
                blobs,
                textBindings,
                jsonBindings,
                dataBindings,
                kvBindings,
            };

            respond.status(200).message(data).throw();
        } catch (e) {
            respond.rethrow(e);

            respond
                .status(500)
                .message({ error: 'Internal server error' })
                .throw();
        }
    },
);

projectSpecificVersionsRouter.post(
    '/',
    async (req: Request<ParentRouterParams>, res) => {
        try {
            const db = getDatabase();
            const _sql = getSql();

            await authenticate(req);

            const data = NewProjectVersionRequestBodySchema.parse(req.body);

            const result = await db.$primary.transaction(async (txn) => {
                const project = await txn.query.projects.findFirst({
                    where: eq(projects.id, req.params.projectId),
                    with: {
                        projectVersions: {
                            orderBy: desc(projectVersions.version),
                            limit: 1,
                        },
                    },
                });

                if (!project) {
                    respond
                        .status(404)
                        .message({ error: 'Project Not found' })
                        .throw();
                    return;
                }

                const currentProjectVersion = project.projectVersions[0];

                const newVersion = currentProjectVersion
                    ? currentProjectVersion.version + 1
                    : 1;

                const newBlobs = await txn
                    .insert(dataBlobs)
                    .values(
                        data.blobs.map((blob) => ({
                            id: nanoid(),
                            data: blob.data,
                            filename: blob.filename,
                            type: blob.type,
                        })),
                    )
                    .returning();

                const newProjectVersion = await txn
                    .insert(projectVersions)
                    .values({
                        id: nanoid(),
                        projectId: project.id,
                        version: newVersion,
                    })
                    .returning();

                const newRoutes = await txn
                    .insert(projectVersionRoutes)
                    .values(
                        data.routes.map((route) => ({
                            id: nanoid(),
                            host: route.host,
                            basePaths: route.basePaths,
                            projectVersionId: newProjectVersion[0].id,
                        })),
                    )
                    .returning();

                await txn.insert(projectVersionBlobs).values(
                    newBlobs.map((blob, index) => ({
                        id: nanoid(),
                        blobId: blob.id,
                        projectVersionId: newProjectVersion[0].id,
                        order: index,
                    })),
                );

                const newTextBindings =
                    data.textBindings && data.textBindings.length > 0
                        ? await txn
                              .insert(projectVersionTextBindings)
                              .values(
                                  data.textBindings.map((binding) => ({
                                      id: nanoid(),
                                      name: binding.name,
                                      value: binding.value,
                                      projectVersionId: newProjectVersion[0].id,
                                  })),
                              )
                              .returning()
                        : [];

                const newJsonBindings =
                    data.jsonBindings && data.jsonBindings.length > 0
                        ? await txn
                              .insert(projectVersionJsonBindings)
                              .values(
                                  data.jsonBindings.map((binding) => ({
                                      id: nanoid(),
                                      name: binding.name,
                                      value: binding.value,
                                      projectVersionId: newProjectVersion[0].id,
                                  })),
                              )
                              .returning()
                        : [];

                const newDataBindings =
                    data.dataBindings && data.dataBindings.length > 0
                        ? await txn
                              .insert(projectVersionDataBindings)
                              .values(
                                  data.dataBindings.map((binding) => ({
                                      id: nanoid(),
                                      name: binding.name,
                                      base64: binding.base64,
                                      projectVersionId: newProjectVersion[0].id,
                                  })),
                              )
                              .returning()
                        : [];

                const newKvBindings =
                    data.kvBindings && data.kvBindings.length > 0
                        ? await txn
                              .insert(projectVersionKvDatabaseBinding)
                              .values(
                                  data.kvBindings.map((binding) => ({
                                      kvDatabaseId: binding.kvDatabaseId,
                                      projectVersionId: newProjectVersion[0].id,
                                      name: binding.name,
                                  })),
                              )
                              .returning()
                        : [];

                const routes = newRoutes.map((route) => ({
                    id: route.id,
                    host: route.host,
                    basePaths: route.basePaths,
                }));

                const blobs = newBlobs.map((blob) => ({
                    id: blob.id,
                    digest: base64Hash(blob.data),
                    filename: blob.filename,
                    type: blob.type,
                }));

                const textBindings = newTextBindings.map((binding) => ({
                    id: binding.id,
                    name: binding.name,
                    value: binding.value,
                }));

                const jsonBindings = newJsonBindings.map((binding) => ({
                    id: binding.id,
                    name: binding.name,
                    value: binding.value,
                }));

                const dataBindings = newDataBindings.map((binding) => ({
                    id: binding.id,
                    name: binding.name,
                    digest: base64Hash(binding.base64),
                }));

                const kvBindings = newKvBindings.map((kv) => ({
                    name: kv.name,
                    kvDatabaseId: kv.kvDatabaseId,
                }));

                _sql.notify('project_versions', 'reload');

                const _data: ProjectVersionsDataResponseBodyType = {
                    id: newProjectVersion[0].id,
                    version: newProjectVersion[0].version,
                    projectId: newProjectVersion[0].projectId,
                    deployed_at: newProjectVersion[0].createdAt.getTime(),
                    routes,
                    blobs,
                    textBindings,
                    jsonBindings,
                    dataBindings,
                    kvBindings,
                };

                return _data;
            });

            if (result) {
                respond.status(200).message(result).throw();
                return;
            }
        } catch (e) {
            // console.log('e', e);
            respond.rethrow(e);

            if (e instanceof ZodError) {
                respond
                    .status(400)
                    .message({ error: 'Invalid request body.' })
                    .throw();
                return;
            }

            respond
                .status(500)
                .message({ error: 'Internal server error' })
                .throw();
        }
    },
);

projectSpecificVersionsRouter.get(
    '/:id',
    async (req: Request<ParentRouterParams & { id: string }>, res) => {
        try {
            const db = getDatabase();

            await authenticate(req);

            console.log('req.params.projectId');
            console.log(req.params.projectId);
            console.log('req.params.version');
            console.log(req.params.id);

            const project = await db.query.projects.findFirst({
                where: eq(projects.id, req.params.projectId),
                with: {
                    projectVersions: {
                        where: eq(projectVersions.id, req.params.id),
                        with: {
                            projectVersionBlobs: {
                                with: {
                                    blob: true,
                                },
                            },
                            routes: true,
                            textBindings: true,
                            jsonBindings: true,
                            dataBindings: true,
                            kvDatabases: true,
                        },
                    },
                },
            });

            console.log('project');
            console.log(project);

            if (!project) {
                respond
                    .status(404)
                    .message({ error: 'Project Not found' })
                    .throw();
                return;
            }

            if (!project.projectVersions[0]) {
                respond
                    .status(404)
                    .message({ error: 'Version Not found' })
                    .throw();
                return;
            }

            const projectVersion = project.projectVersions[0];

            const routes = projectVersion.routes.map((route) => ({
                id: route.id,
                host: route.host,
                basePaths: route.basePaths,
            }));

            const blobs = projectVersion.projectVersionBlobs.map((blob) => ({
                id: blob.blob.id,
                digest: base64Hash(blob.blob.data),
                filename: blob.blob.filename,
                type: blob.blob.type,
            }));

            const textBindings = projectVersion.textBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                value: binding.value,
            }));

            const jsonBindings = projectVersion.jsonBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                value: binding.value,
            }));

            const dataBindings = projectVersion.dataBindings.map((binding) => ({
                id: binding.id,
                name: binding.name,
                digest: base64Hash(binding.base64),
            }));

            const kvBindings = projectVersion.kvDatabases.map((kv) => ({
                name: kv.name,
                kvDatabaseId: kv.kvDatabaseId,
            }));

            const data: ProjectVersionsDataResponseBodyType = {
                id: projectVersion.id,
                version: projectVersion.version,
                projectId: projectVersion.projectId,
                deployed_at: projectVersion.createdAt.getTime(),
                routes,
                blobs,
                textBindings,
                jsonBindings,
                dataBindings,
                kvBindings,
            };

            respond.status(200).message(data).throw();
        } catch (e) {
            respond.rethrow(e);

            respond
                .status(500)
                .message({ error: 'Internal server error' })
                .throw();
        }
    },
);

export default projectSpecificVersionsRouter;
