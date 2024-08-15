import express, { Express, Request, Response } from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer, Server as HttpServer } from 'node:http';
import { resolve } from 'node:path';
import { ApiRoutes } from './api-routes';
import { error, info, log, warn } from './utils';
import { ReadJsonAsync } from './utils/loaders';

const DEFAULT_SERVER_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    clientPath: '../client/dist',
}

info('initializing...');

ReadJsonAsync('server.config.json').then((serverConfigJson: any) => {
    const serverConfig: any = { ...DEFAULT_SERVER_CONFIG, ...serverConfigJson };
    serverConfig.clientPath = resolve(serverConfig.clientPath);

    log('serverConfig:', serverConfig);

    const app: Express = express();

    app.use((req: Request, res: Response, next: Function) => {
        log(req.method, req.path);
        next();
    });

    app.use(express.static(serverConfig.clientPath));
    app.use('/api', ApiRoutes());

    app.use('*', (req: Request, res: Response) =>
        res.sendFile(resolve(serverConfig.clientPath, 'index.html'))
    );

    const server: HttpServer = createServer(app);

    server.on('listening', () => info(`listening: http://${serverConfig.host}:${serverConfig.port}`));

    const io: WebSocketServer = new WebSocketServer({ server: server });

    io.on('connection', (socket: WebSocket, request: Request) => {
        const ip: string = request.socket.remoteAddress ?? 'unknown';

        log(`${ip} connected`);

        socket.on('disconnected', (info: any) => log(`${ip} disconnected:`, info));
        socket.on('error', (err: Error) => error(`${ip}:`, err));
        socket.on('warning', (wrn: string) => warn(`${ip}:`, wrn));
    });

    server.listen(serverConfig.port, serverConfig.host);
});


