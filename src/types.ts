import type {Dict} from '@blake.regalia/belt';

export type NodeConfig = {
	auth?: string;
	rpc: string;
	lcd?: string;
	headers?: Dict;
};

export type ServiceConfig = {
	chainId: string;
	skipLcdHealthChecks?: boolean;
	tiers: {
		primary: NodeConfig[];
		secondary: NodeConfig[];
	};
};

export type HealthCheckParams = {
	maxLatestBlockAgeMs: number;
	healthCheckTimeoutMs: number;
	healthCheckIntervalMs: number;
	configUpdateIntervalMs: number;
};

export type CheckerConfig = {
	params: HealthCheckParams;
	services: Dict<ServiceConfig>;
};

export type HostStruct = {
	config: CheckerConfig;
	update: () => Promise<void>;
};
