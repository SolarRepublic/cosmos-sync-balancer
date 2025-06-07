FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/SolarRepublic/cosmos-sync-balancer"
WORKDIR /usr/src/app

RUN apk add --no-cache haproxy supervisor inotify-tools \
	&& rm -rf /var/cache/apk/* /tmp/*
COPY supervisord.conf /etc/supervisor/supervisord.conf

COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN npm install -g pnpm
RUN pnpm i --frozen-lockfile

COPY src/ ./src
RUN pnpm run build-app

RUN mkdir /data

ARG HAPROXY_CFG_PATH=/etc/haproxy/haproxy.cfg
ARG PROXY_HOST=0.0.0.0

ENV HAPROXY_CFG_PATH=${HAPROXY_CFG_PATH}
ENV PROXY_HOST=${PROXY_HOST}
ENV PROXY_PORT=''
ENV ADMIN_PORT=''

EXPOSE 23000/tcp
EXPOSE 8443/tcp

USER root

CMD ["node", "dist/balancer/main.js"]
