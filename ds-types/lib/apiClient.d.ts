/** Error thrown when the API responds with a non-2xx status. */
export declare class ApiError extends Error {
    readonly status: number;
    /** Field-level messages from the API (e.g. { email: "E-mail já cadastrado" }). */
    readonly details?: Record<string, string>;
    constructor(status: number, message: string, details?: Record<string, string>);
}
export declare const apiClient: {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    patch: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};
