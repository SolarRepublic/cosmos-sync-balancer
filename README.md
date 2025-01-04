# Cosmos Sync Balancer

A zero-downtime, hot-reloading, load balancer with fallbacks for routing to healthy Cosmos nodes' RPC and LCD endpoints.

Uses haproxy for load balancing. Continuously performs health checks on all configured endpoints and hot reloads when necessary. Health checks ensure nodes are up-to-date (in sync) with the block chain by checking latest block time.

Endpoints are defined using a JSON file and can be modified live using an admin HTTP server (port 23000).


## Usage

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
