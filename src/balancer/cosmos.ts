import type {HealthCheckParams} from '../types';
import type {Dict} from '@blake.regalia/belt';

import {is_object, parse_json_safe, stringify_json} from '@blake.regalia/belt';

export type NodeStatus = {
	hostname: string;
	healthy: boolean;
	reason: string;
};

const health = (p_endpoint: string, s_reason='') => ({
	hostname: new URL(p_endpoint).hostname,
	healthy: !s_reason,
	reason: s_reason,
});


/**
 * Checks a Cosmos node's heath via RPC
 */
export async function check_cosmos_rpc_health(
	g_params: HealthCheckParams,
	p_rpc: string,
	si_chain: string,
	s_auth='',
	h_headers: Dict={}
): Promise<NodeStatus> {
	try {
		// prep response
		let d_res_status!: Response | undefined;

		// prep response text
		let sx_status: string;

		// request path
		const sr_path = '/status';

		// attempt status check
		try {
			// fetch node status
			d_res_status = await fetch(`${p_rpc}${sr_path}`, {
				signal: AbortSignal.timeout(g_params.healthCheckTimeoutMs),
				...s_auth? {
					headers: {
						Authorization: s_auth,
						...h_headers,
					},
				}: {},
			});

			// parse JSON
			sx_status = await d_res_status.text();
		}
		// hande network error
		catch(e_check) {
			return health(p_rpc, `Connection to RPC node for ${si_chain} is currently degraded at ${p_rpc}${sr_path} : ${(e_check as Error).message || 'unknown reason'}`);
		}

		// not OK response
		if(!d_res_status.ok) {
			return health(p_rpc, `RPC node for ${si_chain} returned non-200 status code ${d_res_status.status}: ${sx_status}`);
		}

		// prep status struct
		const g_status: {
			result: {
				node_info: {
					network: string;
				};
				sync_info: {
					catching_up: boolean;
					latest_block_time: string;
				};
			};
		} | undefined = parse_json_safe(sx_status);

		// parsing error
		if(!g_status) {
			return health(p_rpc, `RPC node for ${si_chain} returned body that is not JSON: ${sx_status}`);
		}

		// ref status
		const g_result = g_status?.result;

		// invalid JSON
		if(!is_object(g_result)) {
			return health(p_rpc, `RPC node returned invalid JSON response: ${stringify_json(g_result)}`);
		}

		// expect chain identifiers to match
		if(si_chain !== g_result.node_info?.network) {
			return health(p_rpc, `RPC node for ${si_chain} reported a different chain identifier "${g_result.node_info?.network}"`);
		}

		// expect catching_up to be false
		if(g_result.sync_info?.catching_up) {
			return health(p_rpc, `RPC node for ${si_chain} is currently syncing to the network. Please wait and try again later`);
		}

		// expect latest block time to be recent
		if(Date.now() - new Date(g_result.sync_info?.latest_block_time).getTime() > g_params.maxLatestBlockAgeMs) {
			return health(p_rpc, `RPC node for ${si_chain} is stale. The chain may be undergoing maintenance. Please wait and try again later`);
		}

		// healthy
		// console.debug(`✅  Status check passed for ${si_chain} RPC node <${p_rpc}>`);
		return health(p_rpc);
	}
	catch(e_unknown) {
		return health(p_rpc, `Unexpected error from RPC node ${p_rpc} while parsing response: ${e_unknown}`);
	}
}


/**
 * Checks a Cosmos node's heath via LCD
 */
export async function check_cosmos_lcd_health(
	g_params: HealthCheckParams,
	p_lcd: string,
	si_chain: string,
	s_auth='',
	h_headers: Dict={}
): Promise<NodeStatus> {
	try {
		// prep response
		let d_res_latest!: Response | undefined;

		// prep response text
		let sx_latest: string;

		// request path depending on Cosmos-SDK version
		const sr_path = [''].includes(si_chain)
			? '/blocks/latest'
			: '/cosmos/base/tendermint/v1beta1/blocks/latest';

		// attempt status check
		try {
			// fetch latest block
			d_res_latest = await fetch(`${p_lcd}${sr_path}`, {
				signal: AbortSignal.timeout(g_params.healthCheckTimeoutMs * 1e3),
				...s_auth? {
					headers: {
						Authorization: s_auth,
						...h_headers,
					},
				}: {},
			});

			// read body
			sx_latest = await d_res_latest.text();
		}
		// hande network error
		catch(e_check) {
			return health(p_lcd, `Connection to LCD node for ${si_chain} is currently degraded at ${p_lcd}${sr_path} : ${(e_check as Error).message || 'unknown reason'}`);
		}

		// not OK response
		if(!d_res_latest.ok) {
			return health(p_lcd, `LCD node for ${si_chain} returned non-200 status code ${d_res_latest.status}: ${sx_latest}`);
		}

		// prep status struct
		const g_latest: {
			block: {
				header: {
					chain_id: string;
					height: string;
					time: string;
				};
			};
		} | undefined = parse_json_safe(sx_latest);

		// parsing error
		if(!g_latest) {
			return health(p_lcd, `LCD node for ${si_chain} returned body that is not JSON: ${sx_latest}`);
		}

		// ref header
		const g_header = g_latest?.block?.header;

		// invalid JSON
		if(!is_object(g_header)) {
			return health(p_lcd, `LCD node returned invalid JSON response: ${stringify_json(g_header)}`);
		}

		// expect chain identifiers to match
		if(si_chain !== g_header.chain_id) {
			return health(p_lcd, `LCD node for ${si_chain} reported a different chain identifier "${g_header.chain_id}"`);
		}

		// expect latest block time to be recent
		if(Date.now() - new Date(g_header.time).getTime() > g_params.maxLatestBlockAgeMs) {
			return health(p_lcd, `LCD node for ${si_chain} is stale. The chain may be undergoing maintenance. Please wait and try again later`);
		}

		// healthy
		// console.debug(`✅  Status check passed for ${si_chain} LCD node <${p_lcd}>`);
		return health(p_lcd);
	}
	catch(e_unknown) {
		return health(p_lcd, `Unexpected error from LCD node ${p_lcd} while parsing response: ${e_unknown+''}`);
	}
}

