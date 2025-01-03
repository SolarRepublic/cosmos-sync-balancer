FROM node:22-alpine
WORKDIR /usr/src/app

RUN apk add --no-cache haproxy supervisor inotify-tools \
	&& rm -rf /var/cache/apk/* /tmp/*
COPY supervisord.conf /etc/supervisor/supervisord.conf

COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN npm install -g pnpm
RUN pnpm i --frozen-lockfile

COPY src/ ./src
RUN pnpm run build:tsc

RUN mkdir /data

ARG HAPROXY_CFG_PATH=/etc/haproxy/haproxy.cfg

ENV HAPROXY_CFG_PATH=${HAPROXY_CFG_PATH}
ENV ADMIN_PORT=''
ENV PROXY_HOST=''
ENV PROXY_PORT=''

EXPOSE 23000/tcp
EXPOSE 8443/tcp

USER root

CMD ["node", "dist/balancer/main.js"]
