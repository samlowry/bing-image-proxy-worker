# Bing Image Proxy Worker

Cloudflare Worker для прокси-кеширования изображений Bing с постоянным кешированием.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/samlowry/bing-image-proxy-worker)

## Функциональность

- **Прокси-запросы**: Перенаправляет запросы к Bing Thumbnail API
- **Постоянное кеширование**: Кеширует изображения навсегда в Cloudflare Cache
- **Оптимизация**: Отдает изображения с edge-серверов Cloudflare
- **Автоматическое преобразование**: Интегрируется с основным сайтом
- **WebP/AVIF конвертация**: Автоматическая конвертация в современные форматы с fallback на оригинал
- **Умное определение формата**: Поддержка Accept-заголовка для автоматического выбора формата

## Развертывание

### 1. Развертывание Worker

```bash
cd workers/
npm install
npx wrangler deploy
```

### 2. Настройка домена

После развертывания получите URL Worker и обновите в файлах:
- `src/js/main.js` - замените `your-domain.workers.dev` на реальный URL
- `src/js/bing-proxy.js` - обновите `baseUrl`

### 3. Интеграция с сайтом

Worker автоматически интегрирован в основной сайт через:
- Lazy loading изображений
- Автоматическое преобразование Bing URLs
- Кеширование на стороне клиента

## Использование

### Прямое использование

```javascript
// Импорт helper
import { bingProxy } from './js/bing-proxy.js';

// Генерация proxy URL
const proxyUrl = bingProxy.getProxyUrl('Florida Swingers Clubs', {
  width: 400,
  height: 300
});

// Или из существующего Bing URL
const originalUrl = 'https://th.bing.com/th?q=Florida%20Swingers&w=400&h=300';
const proxyUrl = bingProxy.fromBingUrl(originalUrl);
```

### Автоматическое преобразование

Все изображения с `data-src` содержащие `th.bing.com` автоматически преобразуются в proxy URLs при lazy loading.

## Структура URL

```
https://your-worker.workers.dev/bing-proxy/q=query&w=400&h=300&c=7&rs=1&p=0&o=7&pid=1.1&first=1
```

## Кеширование

- **Cloudflare Cache**: Постоянное кеширование (1 год)
- **Browser Cache**: `Cache-Control: public, max-age=31536000, immutable`
- **Headers**: Добавляются `X-Cache`, `X-Cache-Status` и `X-Format` для отладки
- **Формат-специфичное кеширование**: Каждый формат (JPEG, WebP, AVIF) кешируется отдельно

## Конвертация форматов

Worker поддерживает автоматическую конвертацию изображений в WebP и AVIF:

### Автоматическое определение формата
- По `Accept` заголовку: `Accept: image/avif` → AVIF, `Accept: image/webp` → WebP
- Приоритет: AVIF > WebP > оригинал

### Явное указание формата
- Query параметр: `?format=webp` или `?format=avif`
- Пример: `/api/images/thumbnail?q=Florida&w=400&h=300&format=webp`

### Fallback механизм
- При превышении лимита бесплатного плана (ошибка 9422) возвращается оригинальное изображение
- При ошибках конвертации также возвращается оригинал
- Оригинальные изображения всегда кешируются отдельно

## Безопасность

- Валидация URL параметров
- Ограничение только на Bing Thumbnail API
- Proper error handling
- Rate limiting через Cloudflare

## Мониторинг

Worker логирует:
- Cache hits/misses
- Ошибки запросов
- Статистику использования

## Примеры

### Оригинальный Bing URL
```
https://th.bing.com/th?q=Florida%20Swingers%20Clubs%20%26%20Adult%20Venues%20Guide%202025&w=400&h=300&c=7&rs=1&p=0&o=7&pid=1.1&first=1
```

### Proxy URL (оригинал)
```
https://bing-image-proxy.your-domain.workers.dev/api/images/thumbnail?q=Florida%20Swingers%20Clubs&w=400&h=300&c=7&rs=1&p=0&o=7&pid=1.1&first=1
```

### Proxy URL (WebP)
```
https://bing-image-proxy.your-domain.workers.dev/api/images/thumbnail?q=Florida%20Swingers%20Clubs&w=400&h=300&format=webp
```

### Proxy URL (AVIF)
```
https://bing-image-proxy.your-domain.workers.dev/api/images/thumbnail?q=Florida%20Swingers%20Clubs&w=400&h=300&format=avif
```

### Автоматическое определение формата
При запросе с заголовком `Accept: image/avif` или `Accept: image/webp` формат определяется автоматически без указания параметра `format`.

## Преимущества

1. **Производительность**: Изображения отдаются с edge-серверов
2. **Надежность**: Не зависит от доступности Bing API
3. **Экономия**: Один запрос к Bing, множество отдач из кеша
4. **SEO**: Стабильные URL для изображений
5. **UX**: Быстрая загрузка изображений
