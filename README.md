# Blackbaud OAuth React Application

A modern React application with TypeScript that integrates with Blackbaud's OAuth 2.0 authentication system and Gift List API. Features secure authentication, comprehensive gift data display with image attachments, and production-ready HTTPS deployment.

## Features

- 🔐 **OAuth 2.0 Authentication** with Blackbaud's API
- 🎁 **Gift List Display** with comprehensive data visualization
- 🖼️ **Image Attachment Previews** with inline display
- 📊 **Expandable Table Rows** with detailed information
- 🔒 **Production HTTPS Deployment** with Let's Encrypt
- 💼 **TypeScript** for type safety
- 🎨 **Modern UI** with responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_BLACKBAUD_CLIENT_ID=your_client_id_here
REACT_APP_BLACKBAUD_CLIENT_SECRET=your_client_secret_here
REACT_APP_REDIRECT_URI=https://home.turpault.me/blackbaud/callback
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

### Application URL Structure

The application is served from the `/blackbaud` subpath:
- **Main Application**: `https://home.turpault.me/blackbaud`
- **OAuth Callback**: `https://home.turpault.me/blackbaud/callback`
- **Dashboard**: `https://home.turpault.me/blackbaud/dashboard`

This allows you to serve other content at the root domain while keeping the Blackbaud OAuth app contained within its own subpath.

### Authentication Flow

1. **Login Initiation**: User clicks login button
2. **OAuth Redirect**: Application redirects to Blackbaud authorization endpoint
3. **Authorization**: User grants permissions on Blackbaud's platform
4. **Callback Handling**: Blackbaud redirects back with authorization code
5. **Token Exchange**: Application exchanges code for access token
6. **API Access**: Application uses token for authenticated API requests
7. **Token Refresh**: Automatic token refresh when needed

### Gift Data Display

- **Comprehensive Table**: Displays all gift fields with proper formatting
- **Expandable Rows**: Additional details shown on demand
- **Image Attachments**: Inline preview for image files
- **Currency Formatting**: Proper localization for monetary values
- **Date Formatting**: Consistent date display across the application
- **Error Handling**: Robust error handling with user feedback

### Production Infrastructure

When deploying to production, consider:
- **Web Server**: nginx, Apache, or other web server for serving static files
- **SSL Certificates**: Let's Encrypt or other certificate authority
- **Security Headers**: HSTS, CSP, and other security headers
- **Compression**: Gzip compression for optimized asset delivery
- **Caching**: Proper cache headers for static assets

## API Integration

### Blackbaud Gift API

The application integrates with the Blackbaud Gift API:

- **Endpoint**: `https://api.sky.blackbaud.com/gift/v1/gifts`
- **Authentication**: Bearer token (OAuth 2.0)
- **Pagination**: Supports limit parameter (default: 50)
- **Fields**: Comprehensive gift data including attachments

### Supported Gift Data

- Basic information (ID, constituent, amount, date)
- Gift classification (type, subtype, status)
- Fund allocation (fund, campaign, appeal)
- Receipt information (amount, date, batch number)
- Payment details (method, check number, date)
- Soft credits and acknowledgements
- File attachments with image preview

## Security Features

- **HTTPS Only**: All traffic encrypted with TLS 1.2+
- **HSTS**: HTTP Strict Transport Security enabled
- **CSP Headers**: Content Security Policy headers
- **OAuth State Parameter**: CSRF protection for OAuth flow
- **Secure Token Storage**: Tokens stored securely in localStorage
- **Input Validation**: TypeScript type checking and runtime validation

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

## Troubleshooting

### Common Issues

**Certificate generation fails:**
- Verify DNS is pointing to your server
- Check firewall allows ports 80/443
- Ensure domain is accessible from the internet

**Build fails:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility
- Verify all environment variables are set

**API requests fail:**
- Check OAuth token validity
- Verify Blackbaud API credentials
- Check network connectivity and CORS settings

### Monitoring

For production monitoring, consider:
- Web server access and error logs
- Application performance monitoring
- Server resource monitoring (CPU, memory, disk)
- SSL certificate expiration monitoring

### Deployment Checklist

For production deployment:
- [ ] Build application with `npm run build`
- [ ] Configure web server to serve static files
- [ ] Set up SSL certificates
- [ ] Configure proper security headers
- [ ] Test OAuth flow end-to-end
- [ ] Monitor application performance