// Used only by the local visual fixture, never by the production Vite config.
const user = { id: "topic-preview", provider: "naver", syncToken: "fixture" };
export const useAuth = () => ({ user, isLoggedIn: true });
export const isAdminUser = () => true;
export const getAdminRegistrationKey = () => "naver:topic-preview";
