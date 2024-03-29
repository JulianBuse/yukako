import React, { useEffect, useRef } from 'react';
import { MainLayout } from '@/layouts/main';
import { useGetProjectById } from '@/lib/hooks/data-hooks/projects/get-project-by-id';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertCircle,
    CornerDownRight,
    File,
    Loader2,
    Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { useGetVersionsForProject } from '@/lib/hooks/data-hooks/versions/get-versions-per-proj-pagted';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectVersionsDataResponseBodyType } from '@yukako/types';
import { Link, useSearch } from 'wouter';
import { useListKvDatabases } from '@/lib/hooks/data-hooks/kv/list-kv-databases';
import { Skeleton } from '@/components/ui/skeleton';

type VersionsCardArtifactsProps = {
    artifacts: ProjectVersionsDataResponseBodyType['blobs'];
};

const VersionsCardArtifacts: React.FC<VersionsCardArtifactsProps> = ({
    artifacts,
}) => {
    return (
        <div className='border border-border p-2 flex flex-col gap-y-2'>
            <h1 className='text-lg font-medium'>Artifacts</h1>
            {artifacts.map((artifact) => (
                <React.Fragment key={artifact.id}>
                    <div className='border border-border p-2 bg-background'>
                        <p className='text-md font-medium'>
                            {artifact.filename}
                        </p>
                        <p className='text-sm'>(sha256) {artifact.digest}</p>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
};

type VersionsCardRoutesProps = {
    routes: ProjectVersionsDataResponseBodyType['routes'];
};

const VersionsCardRoutes: React.FC<VersionsCardRoutesProps> = ({ routes }) => {
    return (
        <div className='flex flex-col gap-y-2 border border-border p-2'>
            <h1 className='text-lg font-medium'>Routes</h1>
            {routes.map((route) => {
                const paths =
                    route.basePaths.length > 0 ? route.basePaths : ['/'];

                return (
                    <div className='border border-border p-2 bg-background'>
                        <p className='text-md font-medium'>{route.host}</p>
                        <div className='pl-2'>
                            {paths.map((path) => (
                                <pre className='flex flex-row items-center text-sm'>
                                    <CornerDownRight className='mr-2' />
                                    {path}
                                </pre>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

type VersionsCardKvDatabasesProps = {
    kvDatabases: ProjectVersionsDataResponseBodyType['kvBindings'];
};

const VersionsCardKvDatabases: React.FC<VersionsCardKvDatabasesProps> = ({
    kvDatabases,
}) => {
    const [databases, databaseFetchError, loadingDatabases] =
        useListKvDatabases();

    return (
        <div className='flex flex-col gap-y-2 border border-border p-2'>
            <h1 className='text-lg font-medium'>KV Databases</h1>
            {kvDatabases.map((kv) => (
                <Link href={`/kv/${kv.kvDatabaseId}`}>
                    <div className='border border-border p-2 bg-background hover:bg-accent/40 hover:animate-pulse'>
                        <p className='text-md font-medium'>{kv.name}</p>
                        {loadingDatabases && (
                            <Skeleton className='h-8 w-full' />
                        )}
                        {databaseFetchError && (
                            <p className='text-md text-destructive-foreground bg-destructive p-2 font-normal'>
                                Error fetching database info
                            </p>
                        )}
                        {databases && (
                            <p className='text-md font-normal'>
                                {databases.find(
                                    (db) => db.id === kv.kvDatabaseId,
                                )?.name ?? 'Unknown Database'}
                            </p>
                        )}
                    </div>
                </Link>
            ))}
            {kvDatabases.length === 0 && (
                <p className='text-md font-normal'>
                    This version has no KV Databases.
                </p>
            )}
        </div>
    );
};

type VersionsCardSitesProps = {
    sites: ProjectVersionsDataResponseBodyType['siteBindings'];
};

const VersionsCardSites: React.FC<VersionsCardSitesProps> = ({ sites }) => {
    return (
        <div className='flex flex-col gap-y-2 border border-border p-2'>
            <h1 className='text-lg font-medium'>Sites</h1>
            {sites.map((site) => (
                <div className='border border-border p-2 bg-background'>
                    <p className='text-md font-medium'>{site.name}</p>
                    <p className='text-md font-normal'>
                        {site.files.map((file) => (
                            <p
                                className='ml-4 flex flex-row items-center'
                                key={file.path}>
                                <File className='w-4 h-4 mr-2' />
                                {file.path}
                            </p>
                        ))}
                    </p>
                </div>
            ))}
            {sites.length === 0 && (
                <p className='text-md font-normal'>
                    This version has no sites.
                </p>
            )}
        </div>
    );
};

type VersionsCardBindingsProps = {
    jsonBindings: ProjectVersionsDataResponseBodyType['jsonBindings'];
    textBindings: ProjectVersionsDataResponseBodyType['textBindings'];
    dataBindings: ProjectVersionsDataResponseBodyType['dataBindings'];
};

const VersionsCardBindings: React.FC<VersionsCardBindingsProps> = ({
    jsonBindings,
    textBindings,
    dataBindings,
}) => {
    const hasBindings =
        jsonBindings.length > 0 ||
        textBindings.length > 0 ||
        dataBindings.length > 0;

    return (
        <div className='flex flex-col gap-y-2 border border-border p-2'>
            <h1 className='text-lg font-medium'>Bindings</h1>
            {!hasBindings && (
                <p className='text-md font-medium'>
                    This version has no bindings.
                </p>
            )}
            {jsonBindings.length > 0 && (
                <div className='border border-border flex flex-col gap-y-2 p-2'>
                    <h2 className='text-md font-medium'>Json Bindings</h2>
                    {jsonBindings.map((binding) => (
                        <div className='border border-border p-2 bg-background'>
                            <p className='text-md font-medium'>
                                {binding.name}
                            </p>
                            <pre className='text-sm'>
                                {JSON.stringify(binding.value, undefined, 2)}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
            {textBindings.length > 0 && (
                <div className='border border-border flex flex-col gap-y-2 p-2'>
                    <h2 className='text-md font-medium'>Text Bindings</h2>
                    {textBindings.map((binding) => (
                        <div className='border border-border p-2 bg-background'>
                            <p className='text-md font-medium'>
                                {binding.name}
                            </p>
                            <pre className='text-sm'>
                                {JSON.stringify(binding.value)}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
            {dataBindings.length > 0 && (
                <div className='border border-border flex flex-col gap-y-2 p-2'>
                    <h2 className='text-md font-medium'>
                        Binary/Data Bindings
                    </h2>
                    {dataBindings.map((binding) => (
                        <div className='border border-border p-2 bg-background'>
                            <p className='text-md font-medium'>
                                {binding.name}
                            </p>
                            <p className='text-sm'>(sha256) {binding.digest}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

type VersionCardProps = {
    data: ProjectVersionsDataResponseBodyType;
    badges?: { type: 'primary'; text: string }[];
};

const VersionCard: React.FC<VersionCardProps> = ({ data: version, badges }) => {
    const searchString = useSearch();
    const [isLinkedCard, setIsLinkedCard] = useState(false);

    const ref = useRef<HTMLDivElement>(null);

    console.log({ searchString, version, isLinkedCard });

    useEffect(() => {
        const searchParams = new URLSearchParams(searchString);
        const _version = searchParams.get('version');

        if (_version === version.id && ref.current) {
            setIsLinkedCard(true);
        } else {
            setIsLinkedCard(false);
        }
    }, [searchString]);

    useEffect(() => {
        if (isLinkedCard && ref.current) {
            console.log('scrolling');
            ref.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isLinkedCard]);

    return (
        <>
            <Card ref={ref} className='bg-accent/50 border-t-transparent'>
                <CardHeader className='top-0 sticky bg-gradient-to-b from-background from-75% to-transparent border-t border-border'>
                    <CardTitle className='text-xl flex flex-row items-center'>
                        Deployment V{version.version}
                        {badges &&
                            badges.map((badge) => (
                                <Badge className='ml-2'>{badge.text}</Badge>
                            ))}
                    </CardTitle>
                    <CardDescription>
                        Deployed {new Date(version.deployed_at).toUTCString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-col gap-y-2'>
                    <VersionsCardArtifacts artifacts={version.blobs} />
                    <VersionsCardRoutes routes={version.routes} />
                    <VersionsCardKvDatabases kvDatabases={version.kvBindings} />
                    <VersionsCardSites sites={version.siteBindings} />
                    <VersionsCardBindings
                        jsonBindings={version.jsonBindings}
                        textBindings={version.textBindings}
                        dataBindings={version.dataBindings}
                    />
                </CardContent>
            </Card>
        </>
    );
};

type VersionsPageProps = {
    projectId: string;
    limit: number;
    page: number;
};

const VersionsPage: React.FC<VersionsPageProps> = ({
    projectId,
    limit,
    page,
}) => {
    const [versionData, versionLoadError, loadingVersion] =
        useGetVersionsForProject({
            projectId,
            limit,
            page,
        });

    console.log({ versionData, versionLoadError, loadingVersion });

    return (
        <>
            {loadingVersion && (
                <div className='flex flex-row gap-x-2 items-center'>
                    <Loader2 className='w-6 h-6 mr-2 animate-spin' /> Loading...
                </div>
            )}
            {versionLoadError && (
                <Alert variant='destructive'>
                    <AlertCircle className='w-4 h-4 mr-2' />
                    <AlertTitle>
                        An Error has Occurred loading page {page}
                    </AlertTitle>
                </Alert>
            )}
            {versionData &&
                versionData.map((version, idx) => (
                    <VersionCard data={version} key={idx} />
                ))}
        </>
    );
};

type VersionsSectionProps = {
    projectId: string;
    latestVersion: number | null;
};

const VersionsSection: React.FC<VersionsSectionProps> = ({
    projectId,
    latestVersion,
}) => {
    const limit = 50;
    const maxPage =
        latestVersion !== null ? Math.ceil(latestVersion / limit) : 1;

    const [loadedPageCount, setLoadedPageCount] = useState(1);
    const maxPagesReached = loadedPageCount >= maxPage;

    const loadMore = () => {
        if (loadedPageCount < maxPage) {
            setLoadedPageCount(loadedPageCount + 1);
        }
    };

    return (
        <>
            <div>
                <h1 className='text-2xl font-medium mb-2'>Versions</h1>
                {latestVersion === null && (
                    <Alert>
                        <Terminal className='w-6 h-6 mr-2' />
                        <AlertTitle>
                            You have not yet deployed this project!
                        </AlertTitle>
                        <AlertDescription>
                            You can use the &#96;yukactl projects deploy&#96;
                            command to deploy your project. For further
                            information you can reference the docs.
                        </AlertDescription>
                    </Alert>
                )}
                {latestVersion !== null && (
                    <>
                        <div className='flex flex-col gap-y-2'>
                            {Array.from(
                                { length: loadedPageCount },
                                (_, i) => i + 1,
                            ).map((page) => (
                                <VersionsPage
                                    key={page}
                                    projectId={projectId}
                                    limit={limit}
                                    page={page}
                                />
                            ))}
                        </div>
                        <Button
                            className='mt-2'
                            disabled={maxPagesReached}
                            onClick={loadMore}>
                            Load More
                        </Button>
                    </>
                )}
            </div>
        </>
    );
};

type Props = {
    id: string;
};

export const ProjectByIdPage: React.FC<Props> = ({ id }) => {
    const [projectData, projectLoadError, loadingProject] =
        useGetProjectById(id);

    return (
        <MainLayout
            breadcrumbs={[
                { name: 'projects', href: '/projects', loading: false },
                projectData
                    ? {
                          name: projectData.name,
                          href: `/projects/${id}`,
                          loading: false,
                      }
                    : { loading: true },
            ]}
            selectedTab='projects'>
            {loadingProject && (
                <>
                    <div className='w-full h-[75vh] flex flex-row items-center justify-center'>
                        <p className='flex flex-row items-center'>
                            <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            Loading Project...
                        </p>
                    </div>
                </>
            )}
            {projectLoadError && (
                <>
                    <div className='w-full h-[75vh] flex flex-row items-center justify-center'>
                        <Alert variant='destructive'>
                            <AlertCircle className='w-4 h-4 mr-2' />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                                {projectLoadError ??
                                    'An unknown error has occurred.'}
                            </AlertDescription>
                        </Alert>
                    </div>
                </>
            )}
            {projectData && (
                <>
                    <h1 className='text-3xl font-medium'>{projectData.name}</h1>
                    <h3 className='text-lg font-normal mb-4'>
                        (id) {projectData.id}
                        <br />
                        (created at){' '}
                        {new Date(projectData.created_at).toDateString()}
                    </h3>
                    <VersionsSection
                        projectId={id}
                        latestVersion={
                            projectData.latest_version?.version ?? null
                        }
                    />
                </>
            )}
        </MainLayout>
    );
};
