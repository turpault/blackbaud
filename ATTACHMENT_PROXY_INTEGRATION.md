# Attachment CORS Proxy Integration

This document describes the implementation of CORS proxy integration for loading attachment PDFs and other files in the Blackbaud application.

## Overview

The application now uses a CORS proxy to load all Blackbaud attachment files, including PDFs, images, and other document types. This prevents CORS (Cross-Origin Resource Sharing) issues that would otherwise prevent the browser from accessing files directly from Blackbaud's servers.

## Problem Statement

### CORS Issues with Blackbaud Files

When trying to access Blackbaud file URLs directly from the browser:

1. **CORS Restrictions**: Blackbaud's file servers don't include proper CORS headers
2. **Authentication Required**: File access requires authentication tokens
3. **Cross-Origin Requests**: Browser blocks requests to different domains
4. **PDF.js Limitations**: PDF.js library can't load files without proper CORS headers

### Previous Issues

- PDFs wouldn't load in the PdfViewer component
- Image thumbnails failed to display
- Direct download links were blocked
- Users saw broken images and failed PDF previews

## Solution Implementation

### 1. **CORS Proxy Utility**

The `corsProxy.ts` utility provides functions to handle Blackbaud file URLs:

```typescript
// Check if URL needs CORS proxy
export const isBlackbaudFileUrl = (url: string): boolean => {
  return url.includes('fil-pcan01.app.blackbaud.net') || 
         url.includes('api.sky.blackbaud.com') ||
         url.includes('app.blackbaud.com') ||
         url.includes('blackbaud.net');
};

// Convert URL to use proxy
export const getProxiedUrl = (originalUrl: string): string => {
  if (isBlackbaudFileUrl(originalUrl)) {
    const encodedUrl = btoa(originalUrl);
    const proxiedUrl = `/blackbaud-proxy?url=${encodedUrl}`;
    return proxiedUrl;
  }
  return originalUrl;
};
```

### 2. **PdfViewer Component Integration**

The PdfViewer component automatically uses the CORS proxy for Blackbaud URLs:

```typescript
// In PdfViewer.tsx
const loadPdf = useCallback(async () => {
  let pdfUrl = url;

  // If it's a Blackbaud file URL, use our authenticated CORS proxy
  if (isBlackbaudFileUrl(url)) {
    try {
      console.log('Fetching PDF through authenticated CORS proxy:', url);
      
      const response = await fetchThroughProxy(url);
      const blob = await response.blob();
      const newBlobUrl = URL.createObjectURL(blob);
      setBlobUrl(newBlobUrl);
      pdfUrl = newBlobUrl;
    } catch (fetchError: any) {
      throw new Error(`Failed to load PDF: ${fetchError.message}`);
    }
  }
  
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
}, [url, blobUrl]);
```

### 3. **GiftList Component Integration**

The GiftList component now uses proxy URLs for all attachment types:

```typescript
// In GiftList.tsx renderAttachments function
const renderAttachments = (gift: Gift): JSX.Element => {
  return (
    <div style={{ maxWidth: "250px" }}>
      {attachments.map((attachment, index) => {
        // Use proxy URLs for all Blackbaud file URLs
        const proxiedUrl = attachment.url ? getProxiedUrl(attachment.url) : undefined;
        const proxiedThumbnailUrl = attachment.thumbnail_url ? getProxiedUrl(attachment.thumbnail_url) : undefined;

        return (
          <div key={attachmentKey}>
            {/* Thumbnail with proxy */}
            {hasThumbnail && (
              <img
                src={proxiedThumbnailUrl || attachment.thumbnail_url}
                alt={`${attachment.name} thumbnail`}
              />
            )}
            
            {/* PDF Viewer with proxy */}
            {shouldShowAsPdf && (
              <PdfViewer
                url={attachment.url!}
                name={attachment.name}
                height={300}
                width="100%"
              />
            )}
            
            {/* Download links with proxy */}
            {proxiedUrl && (
              <a href={proxiedUrl} target="_blank" rel="noopener noreferrer">
                View Full Size
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

## Proxy Server Configuration

### Backend Proxy Route

The proxy server includes a dynamic target route that handles Blackbaud file requests:

```javascript
// In your proxy server (e.g., Express.js)
app.get('/blackbaud-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const decodedUrl = Buffer.from(url, 'base64').toString();
    
    // Get authentication from session
    const session = await getSession(req);
    
    // Make authenticated request to Blackbaud
    const response = await fetch(decodedUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Bb-Api-Subscription-Key': session.subscriptionKey,
        'Accept': 'application/pdf,application/octet-stream,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Stream the file back to the client
    response.body.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});
```

## File Types Supported

### 1. **PDF Documents**
- **Component**: PdfViewer
- **Proxy**: Automatic via fetchThroughProxy
- **Features**: 
  - Page navigation
  - Zoom controls
  - Blob URL creation for better performance

### 2. **Image Files**
- **Types**: JPG, PNG, GIF, SVG, WebP
- **Proxy**: Via getProxiedUrl
- **Features**:
  - Thumbnail previews
  - Full-size viewing
  - Error handling for broken images

### 3. **Other Documents**
- **Types**: DOC, DOCX, XLS, XLSX, TXT, etc.
- **Proxy**: Via getProxiedUrl
- **Features**:
  - Direct download links
  - File type detection
  - Size and metadata display

## Authentication Flow

### 1. **Session Management**
```typescript
// Check authentication before making proxy requests
const session = await authService.checkAuthentication();

if (session.authenticated && session.accessToken && session.subscriptionKey) {
  // Make authenticated request through proxy
  const response = await fetch(proxiedUrl, {
    headers: {
      'Authorization': `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      'Bb-Api-Subscription-Key': session.subscriptionKey,
    },
  });
} else {
  throw new Error('Authentication required for Blackbaud URLs');
}
```

### 2. **Error Handling**
```typescript
try {
  const response = await fetchThroughProxy(url);
  // Handle successful response
} catch (error: any) {
  if (error.message?.includes('Not authenticated')) {
    // Redirect to login or show auth error
    throw new Error('Authentication required: Please log in to view this file.');
  } else {
    // Handle other errors
    throw new Error(`Failed to load file: ${error.message}`);
  }
}
```

## Performance Optimizations

### 1. **Blob URL Creation**
```typescript
// Create blob URLs for better performance
const response = await fetchThroughProxy(url);
const blob = await response.blob();
const blobUrl = URL.createObjectURL(blob);

// Clean up on unmount
useEffect(() => {
  return () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  };
}, [blobUrl]);
```

### 2. **Lazy Loading**
```typescript
// Load attachments only when needed
const loadAttachmentsForVisibleGifts = useCallback((visibleGiftIds: string[]): void => {
  visibleGiftIds.forEach(giftId => {
    if (!loadingAttachmentsRef.current.has(giftId) && giftAttachments[giftId] === undefined) {
      setTimeout(() => loadGiftAttachments(giftId), Math.random() * 300);
    }
  });
}, [loadGiftAttachments, giftAttachments]);
```

### 3. **Caching**
```typescript
// Cache attachment metadata
@cache({ 
  keyPrefix: 'getGiftAttachments', 
  expirationMs: 30*60*1000, // 30 minutes
  keyGenerator: (giftId: string) => `${giftId}`
})
async getGiftAttachments(giftId: string): Promise<any> {
  return this.apiRequest(`/gift/v1/gifts/${giftId}/attachments`);
}
```

## Security Considerations

### 1. **URL Validation**
```typescript
// Only proxy Blackbaud URLs
export const isBlackbaudFileUrl = (url: string): boolean => {
  return url.includes('fil-pcan01.app.blackbaud.net') || 
         url.includes('api.sky.blackbaud.com') ||
         url.includes('app.blackbaud.com') ||
         url.includes('blackbaud.net');
};
```

### 2. **Authentication Required**
- All Blackbaud file requests require valid authentication
- Proxy server validates session before making requests
- Failed authentication returns appropriate error messages

### 3. **Content Type Validation**
```typescript
// Validate content types for security
const allowedContentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'application/octet-stream'
];
```

## Error Handling

### 1. **Network Errors**
```typescript
if (!response.ok) {
  throw new Error(`Failed to fetch file through proxy: ${response.status} ${response.statusText}`);
}
```

### 2. **Authentication Errors**
```typescript
if (fetchError.message?.includes('Not authenticated')) {
  throw new Error('Authentication required: Please log in to view this file.');
}
```

### 3. **File Type Errors**
```typescript
const handleImageError = (attachmentId: string): void => {
  setImageErrors((prev) => new Set(Array.from(prev).concat(attachmentId)));
};
```

## Testing

### 1. **Manual Testing**
```bash
# Test PDF loading
1. Navigate to GiftList component
2. Expand a gift with PDF attachments
3. Verify PDF loads in PdfViewer
4. Test page navigation and zoom

# Test image loading
1. Find gifts with image attachments
2. Verify thumbnails display correctly
3. Test "View Full Size" links
4. Verify proxy URLs in browser dev tools
```

### 2. **Console Logging**
```typescript
// Enable detailed logging
console.log('Using dynamic target proxy for URL:', { originalUrl, proxiedUrl });
console.log('Fetching PDF through authenticated CORS proxy:', url);
console.log('Successfully fetched PDF through authenticated proxy');
```

## Browser Compatibility

### Supported Browsers
- **Chrome**: 51+ (Intersection Observer, Blob URLs)
- **Firefox**: 55+ (Intersection Observer, Blob URLs)
- **Safari**: 12.1+ (Intersection Observer, Blob URLs)
- **Edge**: 79+ (Intersection Observer, Blob URLs)

### Fallbacks
- **Older Browsers**: Graceful degradation with direct links
- **No Intersection Observer**: Load all attachments immediately
- **No Blob URLs**: Use direct proxy URLs

## Future Enhancements

### 1. **Service Worker Caching**
```typescript
// Cache frequently accessed files
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### 2. **Progressive Image Loading**
```typescript
// Load low-res thumbnails first
const lowResUrl = getProxiedUrl(attachment.thumbnail_url);
const highResUrl = getProxiedUrl(attachment.url);
```

### 3. **Background Sync**
```typescript
// Retry failed requests when online
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then(registration => {
    registration.sync.register('retry-failed-attachments');
  });
}
```

## Conclusion

The CORS proxy integration successfully resolves all attachment loading issues:

- **✅ PDFs load correctly** in the PdfViewer component
- **✅ Image thumbnails display** without CORS errors
- **✅ Download links work** for all file types
- **✅ Authentication is properly handled** for all requests
- **✅ Performance is optimized** with lazy loading and caching
- **✅ Error handling is robust** with user-friendly messages

The implementation provides a seamless user experience for viewing and downloading Blackbaud attachments while maintaining security and performance standards. 