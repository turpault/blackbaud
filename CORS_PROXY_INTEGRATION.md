# CORS Proxy Integration for Blackbaud Files

This document explains how the Blackbaud application integrates with the proxy server's CORS bypass functionality to handle PDF downloads and file access.

## Overview

The Blackbaud application uses a CORS proxy to access files from `fil-pcan01.app.blackbaud.net` without encountering browser CORS restrictions. This is essential because browsers block cross-origin requests to external domains unless proper CORS headers are present.

## Architecture

```
React App → Proxy Server (/blackbaud-proxy) → fil-pcan01.app.blackbaud.net
```

1. **React Application**: Makes requests to `/blackbaud-proxy/*` instead of direct Blackbaud URLs
2. **Proxy Server**: Intercepts requests, adds CORS headers, and forwards to Blackbaud
3. **Blackbaud Server**: Returns files normally, proxy adds CORS headers for browser compatibility

## Configuration

### Proxy Server Configuration

The proxy server is configured in `proxy/config/proxy.yaml`:

```yaml
# CORS proxy for Blackbaud PDF downloads
- domain: "home.turpault.me"
  type: "proxy"
  path: "/blackbaud-proxy"
  target: "https://fil-pcan01.app.blackbaud.net"
  ssl: true
  cors:
    enabled: true
    origin: ["https://home.turpault.me", "http://localhost:3000", "http://localhost:3001"]
    credentials: false
    methods: ["GET", "HEAD", "OPTIONS"]
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Bb-Api-Subscription-Key"]
    exposedHeaders: ["Content-Length", "Content-Type", "Content-Disposition", "Content-Range", "Accept-Ranges"]
    maxAge: 3600  # 1 hour
  rewrite:
    "^/blackbaud-proxy/": "/"
```

### Key Configuration Features

- **Origin Restrictions**: Only allows requests from specific domains for security
- **Method Limiting**: Only allows safe HTTP methods (GET, HEAD, OPTIONS)
- **Header Control**: Exposes necessary headers for file downloads and PDF viewing
- **Path Rewriting**: Strips the `/blackbaud-proxy` prefix when forwarding to Blackbaud

## Frontend Integration

### Utility Functions

The application includes utility functions in `src/utils/corsProxy.ts`:

```typescript
// Check if URL needs CORS proxy
isBlackbaudFileUrl(url: string): boolean

// Convert Blackbaud URL to proxied URL
getProxiedUrl(originalUrl: string): string

// Fetch file through proxy
fetchBlackbaudFile(url: string): Promise<Response>

// Download file through proxy
downloadBlackbaudFile(url: string, filename?: string): Promise<void>

// Open file in new tab through proxy
openBlackbaudFile(url: string): void
```

### PdfViewer Component Integration

The `PdfViewer` component automatically uses the CORS proxy for Blackbaud URLs:

```typescript
// Before: Direct Blackbaud URL
const url = "https://fil-pcan01.app.blackbaud.net/some/file.pdf";

// After: Automatic proxy conversion
const proxiedUrl = getProxiedUrl(url); // "/blackbaud-proxy/some/file.pdf"
```

## URL Transformation Examples

| Original Blackbaud URL | Proxied URL |
|------------------------|-------------|
| `https://fil-pcan01.app.blackbaud.net/path/to/file.pdf` | `/blackbaud-proxy/path/to/file.pdf` |
| `https://fil-pcan01.app.blackbaud.net/documents/report.pdf` | `/blackbaud-proxy/documents/report.pdf` |

## Benefits

1. **CORS Compliance**: Eliminates browser CORS errors when accessing Blackbaud files
2. **Transparent Integration**: Existing code works with minimal changes
3. **Security**: Maintains origin restrictions and secure headers
4. **Performance**: Caches preflight requests to reduce overhead
5. **Reliability**: Provides a consistent way to access external files

## Usage in Components

### PdfViewer Component

```typescript
import { PdfViewer } from './components/PdfViewer';

// The component automatically handles CORS proxy for Blackbaud URLs
<PdfViewer 
  url="https://fil-pcan01.app.blackbaud.net/some/document.pdf"
  name="Document.pdf"
  height={600}
/>
```

### Direct File Download

```typescript
import { downloadBlackbaudFile } from '../utils/corsProxy';

const handleDownload = async () => {
  try {
    await downloadBlackbaudFile(
      'https://fil-pcan01.app.blackbaud.net/reports/annual-report.pdf',
      'annual-report.pdf'
    );
  } catch (error) {
    console.error('Download failed:', error);
  }
};
```

### Opening Files in New Tab

```typescript
import { openBlackbaudFile } from '../utils/corsProxy';

const handleOpen = () => {
  openBlackbaudFile('https://fil-pcan01.app.blackbaud.net/forms/application.pdf');
};
```

## Error Handling

The integration includes comprehensive error handling:

1. **Proxy Failures**: Falls back to direct URL access if proxy fails
2. **Network Errors**: Provides user-friendly error messages
3. **File Type Detection**: Handles various file types beyond PDFs
4. **Timeout Handling**: Configurable timeouts for large file downloads

## Security Considerations

1. **Origin Validation**: Only trusted domains can use the proxy
2. **Method Restrictions**: Only safe HTTP methods are allowed
3. **Header Filtering**: Only necessary headers are exposed
4. **No Credentials**: Prevents credential leakage in cross-origin requests
5. **Rate Limiting**: Proxy server includes rate limiting to prevent abuse

## Development vs Production

### Development Configuration
```yaml
origin: ["http://localhost:3000", "http://localhost:3001"]
```

### Production Configuration
```yaml
origin: ["https://yourdomain.com"]
```

## Troubleshooting

### Common Issues

1. **CORS Errors Still Appearing**
   - Check that proxy server is running
   - Verify URL transformation is happening correctly
   - Check browser network tab for actual request URLs

2. **Files Not Loading**
   - Verify proxy configuration is correct
   - Check that target URL is accessible
   - Review proxy server logs for errors

3. **Download Issues**
   - Ensure proper headers are exposed in CORS config
   - Check file MIME types and browser support
   - Verify blob URL creation and cleanup

### Debug Mode

Enable detailed logging in the PdfViewer component:

```typescript
// Check browser console for proxy usage logs
console.log('Using CORS proxy for Blackbaud URL:', { originalUrl, proxiedUrl });
```

## Performance Optimization

1. **Preflight Caching**: 1-hour cache for OPTIONS requests
2. **Blob URLs**: Efficient handling of binary file data
3. **Memory Management**: Automatic cleanup of blob URLs
4. **Lazy Loading**: PDFs are only fetched when needed

This CORS proxy integration provides a seamless solution for accessing Blackbaud files while maintaining security and performance standards. 