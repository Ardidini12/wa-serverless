# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chromium and use the installed version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy all source files including frontend
COPY . .

# Install dependencies (this will also trigger the postinstall script)
RUN npm ci --only=production

# Build the frontend
RUN cd src/frontend && npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"] 