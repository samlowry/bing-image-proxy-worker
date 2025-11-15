/**
 * Bing Image Proxy Worker
 * Caches Bing thumbnail images permanently and serves them from Cloudflare edge
 * Supports WebP/AVIF conversion via Cloudflare Image Resizing with fallback
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
    
    // Determine output format from query param or Accept header
    let format = url.searchParams.get('format') || null;
    const accept = request.headers.get('Accept') || '';
    
    if (!format) {
      // Auto-detect from Accept header
      if (accept.includes('image/avif')) {
        format = 'avif';
      } else if (accept.includes('image/webp')) {
        format = 'webp';
      } else {
        format = 'auto'; // Let Cloudflare decide or return original
      }
    }
    
    // Reconstruct Bing URL
    const bingUrl = `https://th.bing.com/th?${bingParams}`;
    
    try {
      // Create cache key that includes format to cache different formats separately
      const cacheKeyUrl = format !== 'auto' && format !== 'original' && format !== null
        ? `${bingUrl}?format=${format}`
        : bingUrl;
      const cacheKey = new Request(cacheKeyUrl, request);
      const cachedResponse = await caches.default.match(cacheKey);
      
      if (cachedResponse) {
        // Return cached image with proper headers
        const contentType = format === 'avif' ? 'image/avif' 
          : format === 'webp' ? 'image/webp'
          : cachedResponse.headers.get('Content-Type') || 'image/jpeg';
        
        const response = new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Cache': 'HIT',
            'X-Cache-Status': 'cached',
            'X-Format': format || 'original'
          }
        });
        
        return response;
      }
      
      // Fetch original from Bing first
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
      
      let finalResponse = bingResponse;
      let finalFormat = 'original';
      
      // Apply format conversion if requested (and not 'auto' or 'original')
      if (format && format !== 'auto' && format !== 'original') {
        try {
          // Use Cloudflare Image Resizing to convert format
          // AVIF: quality 30-50 (use 40 for optimal compression)
          // WebP: quality 75-85 (use 80 for good balance)
          const quality = format === 'avif' ? 40 : 80;
          
          const convertedResponse = await fetch(bingUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
              'Accept': 'image/*',
              'Referer': 'https://bing.com/'
            },
            cf: {
              image: {
                format: format,
                quality: quality
              }
            }
          });
          
          // Check for 9422 error (free plan limit exceeded)
          if (convertedResponse.status === 500) {
            const errorText = await convertedResponse.text();
            if (errorText.includes('9422')) {
              // Fallback to original image
              console.log('Image conversion limit exceeded (9422), returning original');
              finalResponse = bingResponse;
              finalFormat = 'original';
            } else {
              // Other 500 error - return original as fallback
              finalResponse = bingResponse;
              finalFormat = 'original';
            }
          } else if (convertedResponse.ok) {
            // Conversion successful
            finalResponse = convertedResponse;
            finalFormat = format;
          } else {
            // Non-500 error - return original as fallback
            finalResponse = bingResponse;
            finalFormat = 'original';
          }
        } catch (conversionError) {
          // Conversion failed - return original
          console.error('Conversion error:', conversionError);
          finalResponse = bingResponse;
          finalFormat = 'original';
        }
      }
      
      // Clone response for caching
      const responseToCache = finalResponse.clone();
      
      // Cache the response permanently
      ctx.waitUntil(
        caches.default.put(cacheKey, responseToCache)
      );
      
      // Determine Content-Type based on final format
      const contentType = finalFormat === 'avif' ? 'image/avif'
        : finalFormat === 'webp' ? 'image/webp'
        : finalResponse.headers.get('Content-Type') || 'image/jpeg';
      
      // Return response with caching headers
      const response = new Response(finalResponse.body, {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'MISS',
          'X-Cache-Status': 'fetched-and-cached',
          'X-Format': finalFormat
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
