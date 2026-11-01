// Same-origin deployment (nginx proxies /api and /media to the backend): no CORS, SameSite=Strict cookies.
// If your API lives on another domain, set both values to absolute URLs and read DEPLOYMENT.md first.
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  mediaUrl: '',
};
