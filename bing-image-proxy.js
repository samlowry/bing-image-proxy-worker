/**
 * Bing Image Proxy Worker
 * Caches Bing thumbnail images permanently and serves them from Cloudflare edge
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Support multiple URL formats for better disguise
    let bingParams = '';
    
    // Format 1: /api/images/thumbnail?q=Florida&w=400&h=300
    if (url.pathname.startsWith('/api/images/thumbnail')) {
      bingParams = url.searchParams.toString();
    }
    // Format 2: /thumbnails?query=Florida&width=400&height=300
    else if (url.pathname.startsWith('/thumbnails')) {
      const params = new URLSearchParams();
      params.set('q', url.searchParams.get('query') || '');
      params.set('w', url.searchParams.get('width') || '400');
      params.set('h', url.searchParams.get('height') || '300');
      params.set('c', url.searchParams.get('crop') || '7');
      params.set('rs', url.searchParams.get('resize') || '1');
      params.set('p', url.searchParams.get('padding') || '0');
      params.set('o', url.searchParams.get('orientation') || '7');
      params.set('pid', url.searchParams.get('pid') || '1.1');
      params.set('first', url.searchParams.get('first') || '1');
      bingParams = params.toString();
    }
    // Format 3: /cache?q=Florida&w=400&h=300 (legacy support)
    else if (url.pathname.startsWith('/cache')) {
      bingParams = url.searchParams.toString();
    }
    // Format 4: /bing-proxy/q=Florida&w=400&h=300 (original format)
    else if (url.pathname.startsWith('/bing-proxy')) {
      const pathParts = url.pathname.split('/');
      bingParams = pathParts.slice(2).join('/');
    }
    else {
      return new Response('Not Found', { status: 404 });
    }
    
    // Reconstruct Bing URL
    const bingUrl = `https://th.bing.com/th?${bingParams}`;
    
    try {
      // Check if we have this image cached
      const cacheKey = new Request(bingUrl, request);
      const cachedResponse = await caches.default.match(cacheKey);
      
      if (cachedResponse) {
        // Return cached image with proper headers
        const response = new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: {
            'Content-Type': cachedResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
            'X-Cache': 'HIT',
            'X-Cache-Status': 'cached'
          }
        });
        
        return response;
      }
      
      // Fetch from Bing if not cached
      const bingResponse = await fetch(bingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
          'Accept': 'image/*',
          'Referer': 'https://bing.com/'
        }
      });
      
      if (!bingResponse.ok) {
        return new Response('Failed to fetch image', { status: bingResponse.status });
      }
      
      // Clone response for caching
      const responseToCache = bingResponse.clone();
      
      // Cache the response permanently
      ctx.waitUntil(
        caches.default.put(cacheKey, responseToCache)
      );
      
      // Return response with caching headers
      const response = new Response(bingResponse.body, {
        status: bingResponse.status,
        statusText: bingResponse.statusText,
        headers: {
          'Content-Type': bingResponse.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'MISS',
          'X-Cache-Status': 'fetched-and-cached'
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
