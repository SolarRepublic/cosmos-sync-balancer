# Cosmos Sync Balancer

A zero-downtime, hot-reloading, load balancer with fallbacks for routing to healthy Cosmos nodes' RPC and LCD endpoints.

Uses haproxy for load balancing. Continuously performs health checks on all configured endpoints and hot reloads when necessary. Health checks ensure nodes are up-to-date (in sync) with the block chain by checking latest block time.

Endpoints are defined using a JSON file and can be modified live using an admin HTTP server (port 23000).


## Environment variables

You can optionally provide any of the following environment variables when running the application (also available on the image):

```bash
# optional. setting this to a different value on different deployments will
# shift which endpoints get routed to first for the same config
SYSTEM_INDEX=1

# optional. interface to bind load balancer on. defaults to WAN
PROXY_HOST=0.0.0.0

# optional. port for the load balancer. defaults to 8443
PROXY_PORT=8443

# optional. port for the admin HTTP server. defaults to 23000
ADMIN_PORT=23000

# optional path to read/write haproxy.cfg file. defaults to /etc/haproxy/haproxy.cfg
HAPROXY_CFG_PATH=/etc/haproxy/haproxy.cfg
```


## Using with direct container

Run the container, exposing port 8443 for load-balanced routing, and port 23000 for admin server, mounting the config JSON file to `/data/config.json`:

```bash
docker run -d \
  --name cosmos-sync-balancer \
  --env-file=.env \
  -p 23000:23000 \
  -p 8443:8443 \
  --mount type=bind,source=$(pwd)/build/balancer-prod.json,target=/data/config.json \
  ghcr.io/solarrepublic/cosmos-sync-balancer
```


## Using with docker-compose

```docker-compose
services:
  balancer:
    image: ghcr.io/solarrepublic/cosmos-sync-balancer
    ports:
      - "8443:8443"
      - "23000:23000"
    volumes:
      - "./build/balancer-prod.json:/data/config.json"
```


## Configuration

Generating the config JSON file can be done using the SDK:

`gen-config.js`:
```js
import {defineConfig, defineProviders} from '@solar-republic/cosmos-sync-balancer';

// define custom parametric node providers
const providers = defineProviders({
  quickapi: arg => ({
    rpc: `https://${arg}-rpc.quickapi.com`,
    lcd: `https://${arg}-lcd.quickapi.com`,
  }),

  polkachu: arg => ({
    rpc: `https://${arg}-rpc.polkachu.com`,
    lcd: `https://${arg}-api.polkachu.com`,
  }),
});

// define top-level config
const config = defineConfig({
  // health check parameters
  params: {
    maxLatestBlockAgeMs: 30e3,
    healthCheckTimeoutMs: 10e3,
    healthCheckIntervalMs: 45e3,
    configUpdateIntervalMs: 45e3,
  },

  // services
  services: {
    // any name you want here
    osmosis: {
      chainId: 'osmosis-1',
      tiers: {
        primary: [
          providers.quickapi('osmosis'),
          providers.polkachu('osmosis'),
        ],
        secondary: [
          {
            rpc: 'https://rpc.osmosis.zone',
            lcd: 'https://lcd.osmosis.zone',
          },
        ],
      },
    },

    // any name you want here
    secret: {
      chainId: 'secret-4',
      tiers: {
        primary: [
          // ...
        ],
        secondary: [
          // ...
        ],
      },
    },
  },
});

// print JSON to stdout
console.log(JSON.stringify(config, null, '  '));
```

### Generate the config file

To generate the config for use with the mounting to the docker container:

```bash
node gen-config.js > balancer-prod.json
```

### Routing
Requests to `/{NAME}-rpc/{PATH}` forward to the first healthy RPC endpoint.
Requests to `/{NAME}-lcd/{PATH}` forward to the first healthy LCD endpoint.

### Example:
From the above config example:
```
http://proxy.local:8443/osmosis-rpc/{PATH} => https://osmosis.rpc.quickapi.com/{PATH}
http://proxy.local:8443/osmosis-lcd/{PATH} => https://osmosis.lcd.quickapi.com/{PATH}
```
