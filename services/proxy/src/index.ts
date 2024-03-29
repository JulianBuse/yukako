import * as path from 'path';
import { run } from '@yukako/cli';
import http from 'http';
import httpProxy from 'http-proxy';

let server: http.Server | null = null;

export const ProxyService = {
    start: (workerId: string) => {
        console.log('Starting proxy service...');

        const cli = run();

        const workerPath = path.join(cli.directory, workerId);

        const enginePath = path.join(workerPath, './engine');
        const adminPath = path.join(workerPath, './admin');

        const engineSocket = path.join(enginePath, './engine.sock');
        const adminSocket = path.join(adminPath, './admin.sock');

        const adminHost = cli.adminHost as string;
        const port = cli.port as number;

        const adminProxy = httpProxy.createProxyServer({
            // @ts-ignore
            target: {
                socketPath: adminSocket,
            },
            ws: true,
        });

        const engineProxy = httpProxy.createProxyServer({
            // @ts-ignore
            target: {
                socketPath: engineSocket,
            },
            ws: true,
        });

        const _server = http.createServer((req, res) => {
            const hostHeader = req.headers.host;
            const host = hostHeader?.split(':')[0];

            const pathname = req.url?.split('?')[0];
            const method = req.method;

            const routeToEngine = host && host !== adminHost;

            if (pathname && pathname.startsWith('/__yukako')) {
                const yukakoSecretHeader = req.headers['x-yukako-secret'];
                const yukakoSecret = cli.secret as string;

                if (
                    !yukakoSecretHeader ||
                    yukakoSecretHeader !== yukakoSecret
                ) {
                    res.statusCode = 403;
                    res.end('Forbidden');
                    return;
                }
            }

            // console.log(
            //     `${method} ${host}${pathname} --> ${
            //         routeToEngine ? 'engine' : 'admin'
            //     }`,
            // );

            if (host && host !== adminHost) {
                engineProxy.web(req, res);
            } else {
                adminProxy.web(req, res);
            }
        });

        server = _server;

        _server.listen(port, () => {
            console.log(`Proxy service listening on port ${port}`);
        });
    },
    stop: () => {
        server?.close();

        console.log('Stopping proxy service...');
    },
};
