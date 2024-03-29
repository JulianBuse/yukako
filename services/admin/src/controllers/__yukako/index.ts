import { Router } from 'express';
import { getEnginePath } from '../../lib/get-engine-path';
import { respond } from '../../middleware/error-handling/throwable';
import internalKvRouter from './kv';
import internalQueuesRouter from './queues';

export const yukakoInternalApiRouter = Router();

// yukakoInternalApiRouter.use(morgan('tiny'));

yukakoInternalApiRouter.use('/kv', internalKvRouter);
yukakoInternalApiRouter.use('/queues', internalQueuesRouter);

yukakoInternalApiRouter.get('/', async (req, res) => {
    console.log('yukakoInternalApiRouter.get /');
    const enginePath = getEnginePath();

    respond.status(200).message({ enginePath }).throw();
});

export default yukakoInternalApiRouter;
