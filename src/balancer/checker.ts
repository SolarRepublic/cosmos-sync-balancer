import type {NodeStatus} from './cosmos';
import type {CheckerConfig} from '../types';

import {collapse, entries} from '@blake.regalia/belt';

import {check_cosmos_lcd_health, check_cosmos_rpc_health} from './cosmos';
import {gen_haproxy_cfg} from './haproxy';

// check 
export async function global_health_check(gc_config: CheckerConfig): Promise<string> {
	// destructure config
	const {
		params: g_params,
		services: h_services,
	} = gc_config;

	// collect all async tasks
	const a_tasks: Promise<NodeStatus>[] = [];

	// each service
	for(const [si_service, g_service] of entries(h_services)) {
		// both tiers
		for(const si_tier of ['primary', 'secondary'] as const) {
			// each endpoint
			const a_endpoints = g_service.tiers[si_tier];
			for(const g_endpoint of a_endpoints) {
				// if LCD is present
				if(g_endpoint.lcd) {
					// skip health check
					if(g_service.skipLcdHealthChecks) {
						a_tasks.push(Promise.resolve({
							healthy: true,
							hostname: new URL(g_endpoint.lcd).hostname,
							reason: '',
						}));
					}
					// perform check
					else {
						a_tasks.push(check_cosmos_lcd_health(g_params, g_endpoint.lcd, g_service.chainId, g_endpoint.auth, g_endpoint.headers));
					}
				}

				// RPC is always present
				a_tasks.push(check_cosmos_rpc_health(g_params, g_endpoint.rpc, g_service.chainId, g_endpoint.auth, g_endpoint.headers));
			}
		}
	}

	// wait for all tasks to finish; transform into dict of healths
	const h_statuses = collapse(await Promise.all(a_tasks), (g_status) => {
		// unhealthy node; warn to stderr
		if(!g_status.healthy) {
			console.warn(`⚠️  ${g_status.hostname}: ${g_status.reason}`);
		}

		// transform into entry
		return [g_status.hostname, g_status];
	});

	// generate haproxy cfg
	return gen_haproxy_cfg(h_services, h_statuses);
}
