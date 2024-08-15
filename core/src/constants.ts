export const DEV = (process.env.NODE_ENV?.toLowerCase() !== 'production');
export const ENV = DEV ? 'development' : 'production';