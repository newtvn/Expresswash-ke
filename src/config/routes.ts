/**
 * Application routes configuration
 */
export const ROUTES = {
  HOME: "/",
  TRACK_ORDER: "/track",
  SIGN_IN: "/signin",
  SIGN_UP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  NOT_FOUND: "*",
} as const;

export type RouteKey = keyof typeof ROUTES;
