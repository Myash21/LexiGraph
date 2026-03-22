import { AsyncLocalStorage } from 'node:async_hooks';

export const loggerStorage = new AsyncLocalStorage<string>();

export const logger = {
    log: (message: string, ...args: any[]) => {
        const requestId = loggerStorage.getStore();
        const prefix = requestId ? `[${requestId}] ` : '';
        console.log(`${prefix}${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        const requestId = loggerStorage.getStore();
        const prefix = requestId ? `[${requestId}] ` : '';
        console.error(`${prefix}${message}`, ...args);
    }
};
