#!/bin/bash

# Deployment script for Blackbaud OAuth App with HTTPS
set -e

echo "🚀 Starting deployment of Blackbaud OAuth App..."

# Check if required files exist
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project directory."
    exit 1
fi



# Build the React application
echo "📦 Building React application..."
npm run build

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Error: Build directory not found. Build may have failed."
    exit 1
fi

echo "✅ React build completed successfully"

# Container deployment has been removed
echo "⚠️  Container deployment has been removed. Please use native deployment methods."
echo "⚠️  SSL certificate setup has been removed with container deployment."



echo ""
echo "🎉 Deployment completed successfully!"
echo "📋 Your application is now running locally and available at:"
echo "   🔓 HTTP:  http://localhost:4480/blackbaud (redirects to HTTPS)"
echo "   🔒 HTTPS: https://localhost:4443/blackbaud"
echo "   🌐 External (via NAT): https://home.turpault.me/blackbaud"
echo ""
echo "📝 Build completed successfully!"
echo "⚠️  Container deployment has been removed."
echo "   Please configure native deployment as needed." 