export function loader() {
  return Response.json({
    name: 'Zero',
    short_name: '0',
    description: 'Zero - the first open source email app that puts your privacy and safety first.',
    scope: '/',
    start_url: '/mail/inbox',
    display: 'standalone',
    background_color: '#000',
    theme_color: '#fff',
    icons: [
      {
        src: '/icons-pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons-pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons-pwa/icon-180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  });
}
