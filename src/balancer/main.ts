import type {HostStruct} from '../types';

import {execSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

import {readFile} from 'node:fs/promises';

import {bytes_to_text, parse_json} from '@blake.regalia/belt';

import {create_admin_server} from './admin';
import {global_health_check} from './checker';


// blue/green haproxy.cfg paths
const P_HAPROXY = process.env.HAPROXY_CFG_PATH;

// cache most recent haproxy.cfg
let sx_haproxy_loaded = '';

// host struct
const g_host = {} as HostStruct;

// health check interval
let xt_interval_health_check = 60e3;

// performs health checks and updates haproxy if necessary
async function update_balancer() {
	try {
		// destructure host struct
		const {
			config: gc_config,
		} = g_host;

		// update interval
		xt_interval_health_check = gc_config.params.healthCheckIntervalMs;

		// perform health check
		const sx_haproxy = await global_health_check(gc_config);

		// verbose
		console.debug(' ---- done ----');

		// config is not different
		if(sx_haproxy === sx_haproxy_loaded) return;

		// write destination
		const p_write = P_HAPROXY;

		// need to reload
		console.log(`Writing new config to ${p_write}: \n${sx_haproxy}`);

		// write to config
		writeFileSync(p_write, sx_haproxy, 'utf-8');

		// initial load
		if(!sx_haproxy_loaded) {
			// boot up supervisor
			console.log(bytes_to_text(execSync('supervisord -c /etc/supervisor/supervisord.conf')));
		}
		// reloading
		else {
			// hot reload
			execSync('kill -USR2 $(cat /run/haproxy.pid)');
		}

		// save config
		sx_haproxy_loaded = sx_haproxy;
	}
	catch(e_check) {
		console.error(e_check);
	}
	finally {
		// re-run after some interval
		setTimeout(main, xt_interval_health_check);
	}
}

// main routine
async function main() {
	// start health check
	await update_balancer();
}

// load initial config
const sx_config = await readFile('/data/config.json');

// parse as JSON and set on host object
g_host.config = parse_json(bytes_to_text(sx_config));

// define update function
g_host.update = update_balancer;

// create admin server on the host object
await create_admin_server(g_host);

// start
await main();
