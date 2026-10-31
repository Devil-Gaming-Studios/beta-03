import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const suppressHmrPlugin = {
  name: 'suppress-vite-hmr-ws',
  transformIndexHtml: {
    order: 'pre' as const,
    handler() {
      return [
        {
          tag: 'script',
          attrs: { id: 'vite-hmr-shim' },
          children: `(function(){
  try {
    var NativeWS = window.WebSocket;
    if (!NativeWS) return;
    function ViteSafeWebSocket(url, protocols) {
      if (protocols === 'vite-hmr' || (typeof url === 'string' && (url.indexOf('vite-hmr') !== -1 || url.indexOf('token=') !== -1 || url.indexOf('24678') !== -1))) {
        var self = this;
        this.binaryType = 'blob';
        this.readyState = 1;
        this.url = String(url || '');
        this.protocol = 'vite-hmr';
        this.bufferedAmount = 0;
        this.extensions = '';
        this._listeners = {};
        this.addEventListener = function(event, cb) {
          if (!self._listeners[event]) self._listeners[event] = [];
          self._listeners[event].push(cb);
          if (event === 'open') {
            setTimeout(function() {
              try { cb.call(self, { type: 'open', target: self }); } catch (e) {}
            }, 0);
          }
        };
        this.removeEventListener = function(event, cb) {
          if (!self._listeners[event]) return;
          self._listeners[event] = self._listeners[event].filter(function(fn) { return fn !== cb; });
        };
        this.dispatchEvent = function() { return true; };
        this.send = function() {};
        this.close = function(code, reason) {
          self.readyState = 3;
          var closeHandlers = self._listeners['close'] || [];
          closeHandlers.forEach(function(fn) {
            try { fn.call(self, { type: 'close', wasClean: true, code: code || 1000, reason: reason || '', target: self }); } catch (e) {}
          });
        };
        return this;
      }
      return new NativeWS(url, protocols);
    }
    ViteSafeWebSocket.prototype = NativeWS.prototype;
    ViteSafeWebSocket.CONNECTING = 0;
    ViteSafeWebSocket.OPEN = 1;
    ViteSafeWebSocket.CLOSING = 2;
    ViteSafeWebSocket.CLOSED = 3;
    window.WebSocket = ViteSafeWebSocket;

    var nativeConsoleError = console.error;
    console.error = function() {
      var text = Array.prototype.slice.call(arguments).map(function(arg) {
        return (arg && arg.message) || String(arg);
      }).join(' ');
      if (text.indexOf('WebSocket closed without opened') !== -1 || text.indexOf('failed to connect to websocket') !== -1 || text.indexOf('vite-hmr') !== -1) {
        return;
      }
      return nativeConsoleError.apply(console, arguments);
    };

    window.addEventListener('error', function(e) {
      if (e && e.message && (e.message.indexOf('WebSocket') !== -1 || e.message.indexOf('closed without opened') !== -1)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
    window.addEventListener('unhandledrejection', function(e) {
      var reason = e && e.reason ? (e.reason.message || String(e.reason)) : '';
      if (reason.indexOf('WebSocket') !== -1 || reason.indexOf('closed without opened') !== -1) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  } catch (err) {}
})();`,
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  },
};

export default defineConfig({
  plugins: [
    suppressHmrPlugin,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: 'Mast Meals - KitchenSync',
        short_name: 'KitchenSync',
        description: 'Household meal planner, recipe graph RAG, and kitchen stock assistant for Indian households, powered by Omnirush AI.',
        theme_color: '#032212',
        background_color: '#faf9f6',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['food', 'lifestyle', 'utilities'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
  },
});

