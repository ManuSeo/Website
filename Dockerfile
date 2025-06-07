# Use official Node.js LTS image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json if available
COPY package*.json ./

# Install dependencies
RUN npm install express express-session multer

# Copy the rest of the app files
COPY . .

# Make uploads directory writable
RUN mkdir -p public/uploads

# Expose the port server uses
EXPOSE 3000

# Command to run the app
CMD ["node", "server.js"]
