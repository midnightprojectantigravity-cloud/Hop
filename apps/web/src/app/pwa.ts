export const resolveAppBaseUrl = (baseUrl: string = '/'): string => {
  if (!baseUrl) return '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

export const resolveServiceWorkerUrl = (baseUrl: string = '/'): string =>
  `${resolveAppBaseUrl(baseUrl)}service-worker.js`;

export const registerAppServiceWorker = async (
  navigatorLike: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
  windowLike: Pick<Window, 'addEventListener'> | undefined = typeof window !== 'undefined' ? window : undefined,
  baseUrl: string = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/',
): Promise<void> => {
  if (!navigatorLike?.serviceWorker || !windowLike) return;

  const serviceWorkerUrl = resolveServiceWorkerUrl(baseUrl);
  const register = () => {
    void navigatorLike.serviceWorker.register(serviceWorkerUrl);
  };

  windowLike.addEventListener('load', register, { once: true } as AddEventListenerOptions);
};
