import {
    AuthLoginResponseBodyType,
    AuthRegisterResponseBodyType,
    AuthNewAuthTokenResponseBodyType,
    AuthMeResponseBodyType,
    AuthLoginResponseBodySchema,
    AuthRegisterResponseBodySchema,
    AuthNewAuthTokenResponseBodySchema,
    AuthMeResponseBodySchema,
} from '@yukako/types';
import { handleResponse } from '../util/responseHandler.js';
import { Options } from '../index.js';

export const AuthWrapper = (
    server: string,
    sessionId?: string,
    options?: Options,
) => ({
    login: async (opts: {
        username: string;
        password: string;
    }): Promise<[AuthLoginResponseBodyType, null] | [null, string]> => {
        try {
            const resp = await fetch(`${server}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(opts),
            });

            return handleResponse(AuthLoginResponseBodySchema, resp, options);
        } catch (error) {
            return [null, 'An unknown error occurred.'];
        }
    },
    register: async (opts: {
        username: string;
        password: string;
        newUserToken?: string | null | undefined;
    }): Promise<[AuthRegisterResponseBodyType, null] | [null, string]> => {
        try {
            const resp = await fetch(`${server}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(opts),
            });

            return handleResponse(
                AuthRegisterResponseBodySchema,
                resp,
                options,
            );
        } catch (error) {
            return [null, 'An unknown error occurred.'];
        }
    },
    createNewUserToken: async (): Promise<
        [AuthNewAuthTokenResponseBodyType, null] | [null, string]
    > => {
        try {
            const resp = await fetch(`${server}/api/auth/new-user-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionId ?? '',
                },
            });

            return handleResponse(
                AuthNewAuthTokenResponseBodySchema,
                resp,
                options,
            );
        } catch (error) {
            return [null, 'An unknown error occurred.'];
        }
    },
    me: async (): Promise<[AuthMeResponseBodyType, null] | [null, string]> => {
        try {
            const resp = await fetch(`${server}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': sessionId ?? '',
                },
            });

            return handleResponse(AuthMeResponseBodySchema, resp, options);
        } catch (error) {
            return [null, 'An unknown error occurred.'];
        }
    },
});
