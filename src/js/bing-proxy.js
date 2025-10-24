/**
 * Bing Image Proxy Helper
 * Utility functions for generating proxy URLs with disguised endpoints
 */

export class BingImageProxy {
  constructor(baseUrl = 'https://images.dotsco.org') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Generate proxy URL for Bing thumbnail (disguised as images API)
   * @param {string} query - Search query
   * @param {Object} options - Image options
   * @returns {string} Proxy URL
   */
  getProxyUrl(query, options = {}) {
    const params = new URLSearchParams();
    
    // Required parameters
    params.set('q', query);
    
    // Optional parameters with defaults
    params.set('w', options.width || '400');
    params.set('h', options.height || '300');
    params.set('c', options.crop || '7');
    params.set('rs', options.resize || '1');
    params.set('p', options.padding || '0');
    params.set('o', options.orientation || '7');
    params.set('pid', options.pid || '1.1');
    params.set('first', options.first || '1');
    
    // Use disguised API endpoint
    return `${this.baseUrl}/api/images/thumbnail?${params.toString()}`;
  }
  
  /**
   * Generate proxy URL using thumbnails endpoint
   * @param {string} query - Search query
   * @param {Object} options - Image options
   * @returns {string} Proxy URL
   */
  getThumbnailUrl(query, options = {}) {
    const params = new URLSearchParams();
    
    params.set('query', query);
    params.set('width', options.width || '400');
    params.set('height', options.height || '300');
    params.set('crop', options.crop || '7');
    params.set('resize', options.resize || '1');
    params.set('padding', options.padding || '0');
    params.set('orientation', options.orientation || '7');
    params.set('pid', options.pid || '1.1');
    params.set('first', options.first || '1');
    
    return `${this.baseUrl}/thumbnails?${params.toString()}`;
  }
  
  /**
   * Generate proxy URL from existing Bing URL
   * @param {string} bingUrl - Original Bing thumbnail URL
   * @returns {string} Proxy URL
   */
  fromBingUrl(bingUrl) {
    try {
      const url = new URL(bingUrl);
      if (url.hostname !== 'th.bing.com') {
        throw new Error('Not a Bing thumbnail URL');
      }
      
      const params = url.searchParams.toString();
      return `${this.baseUrl}/api/images/thumbnail?${params}`;
    } catch (error) {
      console.error('Invalid Bing URL:', error);
      return bingUrl; // Return original URL if parsing fails
    }
  }
}

// Default instance with disguised domain
export const bingProxy = new BingImageProxy();
