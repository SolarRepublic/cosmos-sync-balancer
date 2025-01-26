import type {CheckerConfig, HostStruct} from '../types';
import type {JsonObject, JsonValue, Promisable} from '@blake.regalia/belt';

import type {IncomingMessage, ServerResponse} from 'http';

import {createServer} from 'http';

import {bytes_to_text, concat, defer, from_entries, parse_json_safe} from '@blake.regalia/belt';

type MethodHandler = (g_req: JsonValue, g_params: JsonObject, d_res: ServerResponse, d_req: IncomingMessage) => Promisable;


export async function create_admin_server(
	g_host: HostStruct
): Promise<void> {
	const f_reply_config = (d_res: ServerResponse) => d_res.writeHead(200).end(JSON.stringify(g_host.config, null, '  '));
	const f_method_not_allowed = (d_res: ServerResponse) => d_res.writeHead(405).end('Method not allowed');

	const H_ROUTES: Dict<{
		get?: MethodHandler;
		post?: MethodHandler;
	}> = {
		'/config': {
			get(w_, g_params, d_res) {
				return f_reply_config(d_res);
			},

			async post(g_req, g_params, d_res) {
				// update config
				g_host.config = g_req as CheckerConfig;

				// apply update
				await g_host.update();

				// reply with new config confirmation
				return f_reply_config(d_res);
			},
		},
	};

	// determine admin port
	const n_port_admin = Number(process.env.ADMIN_PORT || '23000');

	// defer Promise
	const [dp_listening, fke_listening] = defer<void>();

	// open admin HTTP server
	createServer(async(d_req, d_res) => {
		try {
			// parse request path and query params
			const {
				pathname: s_path,
				searchParams: d_params,
			} = new URL(d_req.url || '');

			// find route
			const g_route = H_ROUTES[s_path];

			// no route
			if(!g_route) return d_res.writeHead(404).end('Not found');

			// parse params
			const g_params = from_entries(d_params.entries());

			// depending on method
			switch(d_req.method!) {
				// HTTP GET
				case 'GET': {
					return g_route.get?.(null, g_params, d_res, d_req) ?? f_method_not_allowed(d_res);
				}

				// HTTP PUT
				case 'PUT': {
					// validate content-type
					const [s_type] = d_req.headers['content-type']?.split(';') || [];
					if(s_type.toLowerCase() !== 'application/json') return d_res.writeHead(400).end('Content-type header must be "application/json"');

					// prep to build chunks
					const a_chunks: Uint8Array[] = [];

					// reach chunks from stream
					for await(const atu8_chunk of d_req) {
						a_chunks.push(atu8_chunk as Uint8Array);
					}

					// UTF-8 decode
					const sx_body = bytes_to_text(concat(a_chunks));

					// parse as JSON
					const g_body = parse_json_safe(sx_body);

					// invalid JSON
					if(!g_body) return d_res.writeHead(400, 'Invalid JSON');

					// handle
					return await g_route.post?.(g_body, g_params, d_res, d_req) ?? f_method_not_allowed(d_res);
				}

				// any othermethod
				default: {
					return f_method_not_allowed(d_res);
				}
			}
		}
		catch(e_route) {
			return d_res.writeHead(500, 'Server error');
		}
	}).listen({
		port: n_port_admin,
	}, () => {
		console.log(`Admin server listening on port ${n_port_admin}`);

		// 
		fke_listening();
	});

	// wait until server is listening
	await dp_listening;
}
