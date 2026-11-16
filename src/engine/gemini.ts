import { compose } from './composer';
// Compatibility entry point for the existing dashboard. No external calls are made.
export const composeWithGemini = async (...args: Parameters<typeof compose>) => compose(...args);
