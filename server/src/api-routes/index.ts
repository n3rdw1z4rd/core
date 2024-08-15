import { Request, Response, Router } from "express";

export function ApiRoutes(/* db, config */) {
    return Router()
        .get('/', (req: Request, res: Response) => {
            res.json({ status: 'success' });
        });
}