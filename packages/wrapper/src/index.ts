import { AuthWrapper } from './auth/index.js';
import { ProjectsWrapper } from './projects/index.js';
import { UsersWrapper } from './users/index.js';
import { VersionsWrapper } from './versions/index.js';
import { KvWrapper } from './kv/index.js';

export type Options = {
    passthroughResult?: boolean;
};

export const BaseWrapper = (
    server: string,
    sessionId: string,
    opts?: Options,
) => ({
    auth: AuthWrapper(server, sessionId),
    projects: ProjectsWrapper(server, sessionId),
    users: UsersWrapper(server, sessionId),
    versions: VersionsWrapper(server, sessionId),
    kv: KvWrapper(server, sessionId),
});

export const WrapperWithoutSession = (server: string, opts?: Options) => ({
    auth: AuthWrapper(server),
});

export const Wrapper = <T extends string | undefined = undefined>(
    server: string,
    sessionId?: T,
): T extends string
    ? ReturnType<typeof BaseWrapper>
    : ReturnType<typeof WrapperWithoutSession> => {
    const url = new URL(server);
    const protocol = url.protocol;
    const hostname = url.host;

    const serverString = `${protocol}//${hostname}`;

    if (sessionId) {
        return BaseWrapper(serverString, sessionId) as any;
    } else {
        return WrapperWithoutSession(serverString) as any;
    }
};

export const PassthroughWrapper = (server: string, sessionId: string) => ({
    auth: AuthWrapper(server, sessionId, { passthroughResult: true }),
    projects: ProjectsWrapper(server, sessionId, { passthroughResult: true }),
    users: UsersWrapper(server, sessionId, { passthroughResult: true }),
    versions: VersionsWrapper(server, sessionId, { passthroughResult: true }),
    kv: KvWrapper(server, sessionId, { passthroughResult: true }),
});
