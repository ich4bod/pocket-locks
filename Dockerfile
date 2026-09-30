FROM node:22-alpine
WORKDIR /app
COPY server.js ./server.js
COPY site ./site
EXPOSE 3000
CMD ["node", "server.js"]
