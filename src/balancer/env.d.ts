declare module 'process' {
	global {
		namespace NodeJS {
			interface ProcessEnv {
				SYSTEM_INDEX?: string;
				ADMIN_PORT?: string;
				PROXY_PORT?: string;
				PROXY_HOST?: string;
				HAPROXY_CFG_PATH: string;
			}
		}
	}
}
