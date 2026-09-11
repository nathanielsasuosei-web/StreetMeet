/**
 * The API base URL.
 * Set EXPO_PUBLIC_API_URL in .env (or in EAS secrets) to your deployed backend,
 * e.g. https://natthesisa-api.onrender.com
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export const SOCKET_URL = API_URL;
