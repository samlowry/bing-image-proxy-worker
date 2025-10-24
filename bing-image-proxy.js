/**
 * Bing Image Proxy Worker
 * Caches Bing thumbnail images permanently and serves them from Cloudflare edge
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Extract Bing image parameters from path
    // Expected format: /bing-proxy/q=Florida%20Swingers%20Clubs&w=400&h=300&c=7&rs=1&p=0&o=7&pid=1.1&first=1
    const pathParts = url.pathname.split('/');
    if (pathParts[1] !== 'bing-proxy') {
      return new Response('Not Found', { status: 404 });
    }
    
    // Reconstruct Bing URL
    const bingParams = pathParts.slice(2).join('/');
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
