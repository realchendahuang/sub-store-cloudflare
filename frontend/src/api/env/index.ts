import request from '@/api';
import { AxiosPromise } from 'axios';

export function useEnvApi() {
  return {
    getEnv: (options?: { timeout?: number }): AxiosPromise<MyAxiosRes> => {
      return request({
        url: '/api/env',
        method: 'get',
        timeout: options?.timeout,
      });
    },
  };
}
