FROM node:lts-alpine
WORKDIR /opt/ccxt-server
# Note: The directory itself is not copied, just its contents.
COPY server.js .
COPY node_modules ./node_modules
EXPOSE 12345
CMD ["node", "server.js", "0.0.0.0", "80"]
