# Stage 1: Build the project
FROM node:18-alpine
WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code and build
COPY . .
RUN npm run build

# Start the application (ensure package.json "start" script points to dist/index.js)
CMD ["npm", "start"]

EXPOSE 3000
