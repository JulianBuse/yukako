import * as path from 'path';
import { nanoid } from 'nanoid';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import chalk from 'chalk';
import * as util from 'util';
import prexit from 'prexit';
import * as fs from 'fs-extra';
import { match } from 'ts-pattern';

let name = 'workerd-instance';
let configLocation: string = path.join(
    process.cwd(),
    './.yukako/engine/config.capnp',
);
let workerdProcess: ChildProcessWithoutNullStreams | null = null;
let manualTermination = false;

const parseLog = (str: string) => {
    const isWorkerdLog = !(
        str.startsWith('__START_YUKAKO_LOG_HEADER__') &&
        str.includes('__END_YUKAKO_LOG_HEADER__ ')
    );
    if (isWorkerdLog) {
        return {
            type: 'workerd' as const,
            value: str,
            id: null,
            name: null,
        };
    }

    const trimStart = str.replace('__START_YUKAKO_LOG_HEADER__', '');
    const [_data, log] = trimStart.split('__END_YUKAKO_LOG_HEADER__ ');

    const data = JSON.parse(_data);

    const logInvalidData = () => {
        console.error('Received invalid log data from workerd');
        console.error(_data, log);
        return {
            type: 'workerd' as const,
            value: 'Received invalid log data from workerd: ' + _data,
            id: null,
            name: null,
        };
    };

    if (!('type' in data) || !('id' in data) || !('name' in data)) {
        return logInvalidData();
    }

    const id = data.id;
    const type = data.type;
    const name = data.name;

    if (
        typeof id !== 'string' ||
        typeof type !== 'string' ||
        typeof name !== 'string'
    ) {
        return logInvalidData();
    }

    switch (type) {
        case 'worker': {
            return {
                type: 'client-worker' as const,
                value: log,
                id,
                name,
            };
        }
        case 'router': {
            return {
                type: 'router' as const,
                value: log,
                id,
                name,
            };
        }
        default: {
            return logInvalidData();
        }
    }
};

const printLog = (
    log: ReturnType<typeof parseLog>,
    type: 'stdout' | 'stderr' = 'stdout',
) => {
    const prefix = match(log)
        .with({ type: 'workerd' }, () => `[workerd]`)
        .with({ type: 'router' }, (log) => `[${log.id}]`)
        .with({ type: 'client-worker' }, (log) => `[${log.name}][${log.id}]`)
        .exhaustive();

    if (type === 'stdout') {
        console.log(`${prefix} ${log.value.trimEnd()}`);
    } else {
        console.error(`${prefix} ${log.value.trimEnd()}`);
    }
};

const handleStdOut = () => {
    return (data: string | Buffer) => {
        const str = data.toString();

        const log = parseLog(str);

        printLog(log);

        // console.log(util.inspect(log, false, null, true /* enable colors */));
    };
};

const handleStdErr = () => {
    return (data: string | Buffer) => {
        const str = data.toString();

        const log = parseLog(str);

        printLog(log, 'stderr');

        // console.error(util.inspect(log, false, null, true /* enable colors */));
    };
};

const handleExit = (opts?: { sockets?: string[] }) => {
    return (code: number) => {
        if (opts?.sockets) {
            opts.sockets.forEach((socket) => {
                console.log(chalk.bold(`Removing socket ${socket}`));
                fs.rmSync(socket, { recursive: true, force: true });
            });
        }

        if (code !== 0) {
            console.error(chalk.red(`[workerd][${name}] exited.`));
        } else {
            console.log(`[workerd][${name}] exited with code ${code}`);
        }

        if (code !== 0) {
            console.log(
                chalk.red.bold(
                    `[workerd][${name}] Exited unexpectedly. Exiting...`,
                ),
            );
            process.exit(1);
        }
    };
};

const handleError = () => {
    return (err: Error) => {
        console.error(chalk.red(`[workerd][${name}] Error: ${err.message}`));
    };
};

export const WorkerdSupervisor = {
    start: (
        _configlocation: string,
        workerid: string,
        opts?: {
            sockets?: string[];
        },
    ) => {
        name = workerid;
        configLocation = _configlocation;
        manualTermination = false;
        console.log(chalk.bold(`Starting workerd process ${name}`));

        const binpath = require.resolve('workerd/bin/workerd');
        const workerd = spawn(binpath, ['serve', configLocation, '--verbose']);

        if (opts?.sockets) {
            opts.sockets.forEach((socket) => {
                // console.log(chalk.bold(`Creating socket ${socket}`));
                // fs.ensureFileSync(socket);
            });
        }

        workerd.stdout.on('data', handleStdOut());
        workerd.stderr.on('data', handleStdErr());
        workerd.on('exit', handleExit({ sockets: opts?.sockets }));
        workerd.on('error', handleError());

        workerdProcess = workerd;
    },
    stop: (opts?: { sockets?: string[] }) => {
        workerdProcess?.kill();
        workerdProcess = null;

        if (opts?.sockets) {
            opts.sockets.forEach((socket) => {
                // console.log(chalk.bold(`Removing socket ${socket}`));
                fs.rmSync(socket, { recursive: true, force: true });
            });
        }
    },
};

prexit(async () => {
    WorkerdSupervisor.stop();
});
