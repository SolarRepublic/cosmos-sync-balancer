import type {NodeStatus} from './cosmos';
import type {NodeConfig, ServiceConfig} from '../types';

import {entries, stringify_json} from '@blake.regalia/belt';

import {aligned, unindent} from './util';

const N_SYSTEM_INDEX = Number(process.env.SYSTEM_INDEX || '1');
const S_PROXY_HOST = process.env.PROXY_HOST || '127.0.0.1';

/**
 * Serializes the haproxy.cfg from current node states
 * @param h_services - set of available service configs
 * @param h_statuses - node statuses
 * @returns 
 */
export function gen_haproxy_cfg(
	h_services: Dict<ServiceConfig>,
	h_statuses: Dict<NodeStatus>
): string {
	// string building
	const a_acls: string[] = [];
	const a_rules: string[] = [];
	const a_backends: string[] = [];

	// where to start allocating ports for new auth blocks
	let n_port = Number(process.env.PROXY_PORT || '23001');

	// each service
	for(const [si_service, g_service] of entries(h_services)) {
		// count the number of primaries online
		let c_primaries = 0;

		// prep tertiary nodes
		let a_tertiaries: NodeConfig[] = [];

		// each resource mode
		for(const si_mode of ['rpc', 'lcd'] as const) {
			// fully qualified ID
			const si_type = `${si_service}_${si_mode}`;

			// path prefix
			const sr_path = `/${si_service}-${si_mode}`;

			// create ACL
			a_acls.push(`acl is_${si_type} path_beg ${sr_path}`);

			// add route rule
			a_rules.push(`use_backend ${si_type} if is_${si_type}`);

			// build server lines
			const a_servers: string[] = [];

			// each tier
			for(const si_tier of ['primary', 'secondary'] as const) {
				// ref endpoints
				const a_endpoints = g_service!.tiers[si_tier];

				// rotate according to system index (creating different order across deployments)
				const n_rotation = N_SYSTEM_INDEX % a_endpoints.length;
				const a_endpoints_rotated = a_endpoints.slice(n_rotation).concat(a_endpoints.slice(0, n_rotation));

				// for first endpoint type only
				if('rpc' === si_mode) {
					// in primary tier
					if('primary' === si_tier) {
						// add others as fallbacks
						a_tertiaries = a_endpoints_rotated.slice(1);

						// only use the first node
						a_endpoints_rotated.splice(1, a_endpoints_rotated.length - 1);
					}
					// secondary tier
					else if('secondary' === si_tier) {
						a_endpoints_rotated.push(...a_tertiaries);
					}
				}

				// each endpoint
				for(const g_endpoint of a_endpoints_rotated) {
					const p_endpoint = g_endpoint[si_mode];

					// mode not defined; skip
					if(!p_endpoint) continue;

					// parse URL
					const d_url = new URL(p_endpoint);

					// extract host
					const s_hostname = d_url.hostname;

					// host is offline; skip it
					if(!h_statuses[s_hostname]?.healthy) continue;

					// create server name
					const s_name = s_hostname;

					// build server
					const a_options: string[] = [
						'server', s_name,
						`${s_hostname}:${d_url.port || ('https:' === d_url.protocol? '443': '80')}`,
						'https:' === d_url.protocol? '': 'no-ssl',
						`sni str(${s_hostname})`,
						'check',
					];

					// primary server; count primary online
					if('primary' === si_tier) {
						c_primaries += 1;
					}
					// secondary, and at least 1 primary is online
					else if(c_primaries) {
						a_options.push('backup');
					}

					// // prep server line
					const sx_server = a_options.join(' ');

					// auth
					if(g_endpoint.auth) {
						// proxy to auth group
						a_servers.push(`server ${s_name}_auth 0.0.0.0:${++n_port} no-ssl`);

						// auth proxy ingress
						a_backends.push(`listen ${s_name}_auth`+unindent(aligned`
							bind *:${n_port}

							# in the response, set a header to indicate which server was routed to
							http-response add-header Proxied-Server-Domain %[srv_name]

							# set the Host header to the name of the selected server (using its hostname)
							http-send-name-header Host

							default-server ssl check-ssl verify required ca-file /etc/ssl/certs/ca-certificates.crt
							http-request set-header Authorization ${stringify_json(g_endpoint.auth)}
							${sx_server}
						`));
					}
					else {
						// add server line
						a_servers.push(sx_server);
					}
				}
			}

			// create backend block
			const s_block = `backend ${si_type}`+unindent(aligned`
				# regularly perform HTTP checks
				option httpchk OPTIONS ${'lcd' === si_mode? '/cosmos/base/tendermint/v1beta1/blocks/latest': '/status'} HTTP/1.1
				http-check expect status 200

				# redispatch if server connection fails
				option redispatch

				# how to distribute the load
				balance roundrobin

				# strip routing part of path
				http-request replace-path ${sr_path}/(.*) /\\1

				# set the Host header to the name of the selected server (using its hostname)
				http-send-name-header Host

				# in the response, set a header to indicate which server was routed to
				http-response add-header Proxied-Server-Domain %[srv_name]

				# default server options
				default-server ssl check-ssl verify required ca-file /etc/ssl/certs/ca-certificates.crt

				# servers
				${a_servers}
			`);

			// add backend
			a_backends.push(s_block);
		}
	}

	const sx_config = aligned`
		global
			log stdout format raw local0 debug
			maxconn 10000
			pidfile /var/run/haproxy.pid
			stats socket /run/haproxy.sock mode 660 level admin expose-fd listeners
			#daemon
			master-worker

		defaults
			log     global
			mode    http

			# logging
			#option  httplog
			#option  httpslog

			# use all available backups instead of just the first one available
			option allbackups

			# timeouts
			timeout connect 10s
			timeout client 60s
			timeout server 60s
			timeout http-request 60s
			timeout check 3s

			# nuber of retries per request (only connection failures)
			retries 3

		resolvers public_dns
			nameserver google1 8.8.8.8:53
			nameserver google2 8.8.4.4:53
			nameserver cloudfare1 1.1.1.1:53
			nameserver cloudfare2 1.0.0.1:53

		frontend http-in
			bind ${S_PROXY_HOST}:8443
			${a_acls}
			${a_rules}

		${a_backends}
	`.split('\n').map(s => s.replace(/^\t\t/, '')).join('\n').trim()+'\n';

	// return generated config
	return sx_config;
}
