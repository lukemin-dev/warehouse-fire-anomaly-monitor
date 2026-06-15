declare const process: {
  env?: {
    EXPO_PUBLIC_SERVER_URL?: string;
  };
};

const configuredServer = process.env?.EXPO_PUBLIC_SERVER_URL?.trim();

export const SERVER_URL =
  configuredServer && configuredServer.length > 0
    ? configuredServer.replace(/\/$/, '')
    : 'http://localhost:5000';

export const SERVER_HOST_LABEL = SERVER_URL.replace(/^https?:\/\//, '');
