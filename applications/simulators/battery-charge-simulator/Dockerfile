# Use an official lightweight Node.js image.
FROM node:16-alpine

# Create and set the working directory.
WORKDIR /app

# Copy package.json and package-lock.json (if available).
COPY package*.json ./

# Install project dependencies.
RUN npm install

# Copy the rest of the application code.
COPY . .

# Expose the port that the app listens on.
EXPOSE 3000

# Define the command to run your application.
CMD [ "node", "index.js" ]
