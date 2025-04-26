# Use the official Node.js LTS (Long Term Support) image
FROM node:14-alpine

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application code to the working directory
COPY . .

# Expose port 3000 to the host machine
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]
