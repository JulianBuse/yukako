#!/usr/bin/env node

import { run } from '@yukako/cli';
import { migrate } from '@yukako/state';
import cluster from 'cluster';
import { nanoid } from 'nanoid';
import { AdminService } from '@yukako/admin';
import { EngineService } from '@yukako/engine';
import { ProxyService } from '@yukako/proxy';
import path from 'path';
import fs from 'fs-extra';
import { LeaderService } from '@yukako/leader';
import { getDatabase } from '@yukako/state/src/db/init';
import { testDB } from '@yukako/state/src/db/test';

const cli = run();
const db = getDatabase();
await testDB(db);
await migrate(db);

const isMaster = cluster.isPrimary || cluster.isMaster;
const workers = cli.workerCount;

const id = cluster.worker?.id.toString() || nanoid();

if (isMaster) {
    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }
} else {
    AdminService.start(id);
    EngineService.start(id);
    ProxyService.start(id);
    LeaderService.start(id);
}

const exitHandler = (
    opts: {
        cleanup?: boolean;
        exit?: boolean;
    },
    exitCode: number,
) => {
    if (opts.cleanup) {
        // const workdir = path.join(process.cwd(), './.yukako/', id);
        // console.log(`Cleaning up ${workdir}`);
        // fs.rmSync(workdir, { recursive: true, force: true });
    }

    if (exitCode || exitCode === 0) {
        console.log(`Exit code: ${exitCode}`);
    }

    if (opts.exit) {
        process.exit();
    }
};

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
