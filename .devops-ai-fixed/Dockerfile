FROM node:1.0.0
RUN apt-get update && apt-get install -y curl
CMD ["node", "app.js"]
WORKDIR /app
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD true
