# Blackbaud OAuth React Application

A modern React application with TypeScript that integrates with Blackbaud's OAuth 2.0 authentication system and Gift List API. Features secure authentication, comprehensive gift data display with image attachments, PDF viewing capabilities, internationalization, and advanced caching.

## Features

- 🔐 **OAuth 2.0 Authentication** with Blackbaud's API via proxy server
- 🎁 **Gift List Display** with comprehensive data visualization
- 🖼️ **Image Attachment Previews** with inline display
- 📄 **PDF Viewer** with embedded PDF.js for document viewing
- 📊 **Expandable Table Rows** with detailed information
- 🌍 **Internationalization** (i18n) with English, French, and French Canadian
- 💾 **Advanced Caching System** with localStorage and decorators
- 👥 **Constituent Management** with detailed profiles
- 📝 **Lists & Queries** management interface
- 📈 **Cache Statistics** and performance monitoring
- 🔄 **Rate Limiting** with automatic retry and exponential backoff
- 💼 **TypeScript** for type safety
- 🎨 **Modern UI** with responsive design and lazy loading

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A proxy server configured for Blackbaud OAuth (see CORS_PROXY_INTEGRATION.md)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Optional: Environment identifier
REACT_APP_ENVIRONMENT=development

# Note: OAuth2 credentials (Client ID, Client Secret) and Subscription Key 
# are now handled by the proxy server for better security.
```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Production Deployment

For production deployment, you'll need to set up a web server and SSL certificates manually.

### Build for Production

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy the build folder** to your web server of choice (nginx, Apache, etc.)

3. **Configure SSL certificates** using your preferred method (Let's Encrypt, etc.)

### Deployment Script

The included `deploy.sh` script will build the React application:

```bash
chmod +x deploy.sh
./deploy.sh
```

Note: Container deployment has been removed. Please configure native deployment as needed.

## Architecture

### Application Structure

```
src/
├── components/           # React components
│   ├── Dashboard.tsx     # Main dashboard with tabs
│   ├── GiftList.tsx      # Gift data display
│   ├── Lists.tsx         # Lists management
│   ├── Queries.tsx       # Queries management
│   ├── ConstituentManager.tsx # Constituent profiles
│   ├── PdfViewer.tsx     # PDF document viewer
│   ├── CacheStatistics.tsx # Cache performance monitoring
│   └── ...
├── services/
│   └── authService.ts    # Authentication and API service
├── utils/
│   ├── cacheDecorator.ts # Advanced caching system
│   └── corsProxy.ts      # CORS proxy utilities
├── locales/              # Internationalization files
│   ├── en/
│   ├── fr/
│   └── fr-CA/
└── i18n.ts              # i18n configuration
```

### Application URL Structure

The application is served from the `/blackbaud` subpath:
- **Main Application**: `https://home.turpault.me/blackbaud`
- **Dashboard**: `https://home.turpault.me/blackbaud/dashboard`
- **Dashboard Tabs**: `https://home.turpault.me/blackbaud/dashboard/{gifts|lists|queries|profile|cache-stats}`
- **Logout**: `https://home.turpault.me/blackbaud/logout`

### Authentication Flow

1. **Login Initiation**: User clicks login button
2. **Proxy Redirect**: Application redirects to proxy server
3. **OAuth Flow**: Proxy server handles Blackbaud OAuth2 flow
4. **Session Management**: Proxy server maintains session and provides tokens
5. **API Access**: Application uses proxy-provided tokens for authenticated API requests
6. **Token Refresh**: Automatic token refresh handled by proxy server

### Dashboard Features

The dashboard includes multiple tabs:

- **🎁 Gifts**: Display and manage gift data with attachments
- **📝 Lists**: View and manage Blackbaud lists
- **🔍 Queries**: Execute and view query results
- **👤 Profile**: User profile and session information
- **📊 Cache Stats**: Monitor caching performance and statistics

### Advanced Caching System

The application includes a sophisticated caching system:

- **Decorator-based caching** for API methods
- **localStorage persistence** with expiration
- **Automatic cache cleanup** of expired entries
- **Cache statistics** and performance monitoring
- **Configurable cache options** (TTL, key generation, etc.)

### Internationalization (i18n)

Supports multiple languages:
- **English (en)**: Default language
- **French (fr)**: French translations
- **French Canadian (fr-CA)**: Canadian French variants

Language detection and switching via `LanguageSelector` component.

### Rate Limiting & Error Handling

- **Automatic retry** with exponential backoff for 429 errors
- **User-friendly error messages** for rate limiting
- **Graceful degradation** when API limits are reached
- **Comprehensive error logging** for debugging

## API Integration

### Blackbaud API Endpoints

The application integrates with multiple Blackbaud APIs:

- **Gifts API**: `https://api.sky.blackbaud.com/gift/v1/gifts`
- **Lists API**: `https://api.sky.blackbaud.com/list/v1/lists`
- **Queries API**: `https://api.sky.blackbaud.com/query/v1/queries`
- **Constituents API**: `https://api.sky.blackbaud.com/constituent/v1/constituents`
- **User Profile API**: `https://api.sky.blackbaud.com/user/v1/users`

### Supported Data Types

- **Gift Information**: ID, constituent, amount, date, classification
- **Gift Attachments**: Images, PDFs, and other documents
- **Constituent Profiles**: Complete constituent information
- **Lists & Queries**: Dynamic data retrieval
- **User Profiles**: Authentication and user information

## Security Features

- **Proxy-based OAuth**: Credentials handled securely by proxy server
- **HTTPS Only**: All traffic encrypted with TLS 1.2+
- **Session Management**: Secure session handling via proxy
- **Input Validation**: TypeScript type checking and runtime validation
- **CORS Handling**: Proper CORS configuration via proxy
- **Rate Limiting**: Built-in protection against API abuse

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support with Blackbaud API integration, refer to:
- [Blackbaud Developer Documentation](https://developer.sky.blackbaud.com/)
- [OAuth 2.0 Guide](https://developer.sky.blackbaud.com/docs/authorization/)
- [Gift API Reference](https://developer.sky.blackbaud.com/docs/services/58bdd5edd7dcde06046081d6)

## Related Documentation

- [CORS Proxy Integration](CORS_PROXY_INTEGRATION.md) - Setup and configuration
- [Hybrid API Setup](HYBRID_API_SETUP.md) - Advanced API configuration

## Deployment Notes

### DNS Configuration
If using a custom domain, ensure proper DNS records:
```
your-domain.com.  A  300  YOUR_SERVER_IP
```

### Server Requirements
For production deployment:
- Modern Linux distribution or hosting platform
- Node.js runtime (for build process)
- Web server (nginx, Apache, etc.)
- SSL certificate setup
- Proxy server for OAuth handling

## Troubleshooting

### Common Issues

**Authentication fails:**
- Verify proxy server is running and accessible
- Check proxy server configuration
- Ensure OAuth credentials are properly configured in proxy

**Build fails:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility
- Verify all environment variables are set

**API requests fail:**
- Check proxy server connectivity
- Verify Blackbaud API credentials in proxy
- Check network connectivity and CORS settings

**Cache issues:**
- Clear browser localStorage
- Check cache statistics in dashboard
- Verify cache configuration

### Monitoring

For production monitoring, consider:
- Web server access and error logs
- Application performance monitoring
- Server resource monitoring (CPU, memory, disk)
- SSL certificate expiration monitoring
- Cache performance metrics

### Deployment Checklist

For production deployment:
- [ ] Build application with `npm run build`
- [ ] Configure web server to serve static files
- [ ] Set up SSL certificates
- [ ] Configure proxy server for OAuth
- [ ] Test OAuth flow end-to-end
- [ ] Monitor application performance
- [ ] Configure caching strategy
- [ ] Test internationalization