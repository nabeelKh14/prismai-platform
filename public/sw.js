// Service Worker for caching and performance optimization
const CACHE_NAME = 'prism-ai-v1'
const STATIC_CACHE = 'prism-ai-static-v1'
const DYNAMIC_CACHE = 'prism-ai-dynamic-v1'

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/_next/static/css/',
  '/_next/static/js/',
  '/_next/static/chunks/',
  '/favicon.ico',
  '/placeholder.jpg',
  '/placeholder.svg',
  '/placeholder-user.jpg',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets...')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName.startsWith('prism-ai-')
            })
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => {
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) return

  // Skip API requests - let them go to network
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Skip admin and auth requests
  if (url.pathname.includes('/admin') || url.pathname.includes('/auth')) {
    return
  }

  event.respondWith(handleRequest(request))
})

// Request handling with different strategies
async function handleRequest(request) {
  const url = new URL(request.url)

  // Static assets - Cache First strategy
  if (isStaticAsset(request.url)) {
    return cacheFirst(request)
  }

  // Images - Cache First with fallback
  if (isImageRequest(request.url)) {
    return cacheFirstWithFallback(request)
  }

  // HTML pages - Network First strategy
  if (isHTMLRequest(request.url)) {
    return networkFirst(request)
  }

  // CSS/JS - Stale While Revalidate
  if (isCSSOrJS(request.url)) {
    return staleWhileRevalidate(request)
  }

  // Default - Network First
  return networkFirst(request)
}

// Cache First strategy
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error('Cache first failed:', error)
    return new Response('Offline content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    })
  }
}

// Cache First with fallback for images
async function cacheFirstWithFallback(request) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // Return placeholder image
    return caches.match('/placeholder.jpg')
  }
}

// Network First strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/')
    }

    return new Response('Offline content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    })
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request)

  // Start network request (don't await it)
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(STATIC_CACHE)
        cache.then((c) => c.put(request, response.clone()))
      }
      return response
    })
    .catch((error) => {
      console.log('Network request failed, using cache:', error)
    })

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse
  }

  // Wait for network response if no cache
  return networkPromise
}

// Helper functions
function isStaticAsset(url) {
  return url.includes('/_next/static/') ||
         url.includes('/favicon.ico') ||
         url.endsWith('.css') ||
         url.endsWith('.js')
}

function isImageRequest(url) {
  return url.includes('/_next/image') ||
         url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)
}

function isHTMLRequest(url) {
  return url.endsWith('/') ||
         url.endsWith('.html') ||
         url.includes('/_next/data/')
}

function isCSSOrJS(url) {
  return url.endsWith('.css') || url.endsWith('.js')
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Handle offline actions when back online
  console.log('Background sync triggered')

  // You can implement custom offline action handling here
  // For example, sync form submissions, analytics data, etc.
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/placeholder.svg',
      badge: '/placeholder.svg',
      tag: data.tag || 'notification',
      requireInteraction: false,
      actions: data.actions || []
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action) {
    // Handle action buttons
    console.log('Notification action clicked:', event.action)
  } else {
    // Handle notification body click
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    event.ports[0].postMessage({
      staticCache: STATIC_CACHE,
      dynamicCache: DYNAMIC_CACHE,
      cacheName: CACHE_NAME
    })
  }
})