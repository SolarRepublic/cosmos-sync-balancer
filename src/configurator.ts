/* eslint-disable @typescript-eslint/naming-convention */
import type {CheckerConfig, NodeConfig} from './types';

export const defineConfig = (gc_config: CheckerConfig): CheckerConfig => gc_config;

/**
 * Typed identity function for defining parametric providers.
 * 
 * ```ts
 * // === Example ===
 * const providers = defineProviders({
 *    example: (chain: string) => ({
 *       rpc: `rpc.${chain}.example.net`,
 *       lcd: `lcd.${chain}.example.net`,
 *    }),
 * });
 * 
 * export default defineConfig({
 *    services: {
 *       'some-path': {
 *          tiers: {
 *             primary: [
 *                providers.example('my-chain-id'),
 *             ],
 *          }
 *       },
 *    },
 * });
 * 
 * // Would create the following routes:
 * // http://balancer.local/some-path-rpc => rpc.my-chain-id.example.net
 * // http://balancer.local/some-path-lcd => lcd.my-chain-id.example.net
 * ```
 * @param h_providers 
 * @returns 
 */
export const defineProviders = <
	// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
	h_providers extends {
		[si_provider: string]: (w_arg: any) => NodeConfig;
	},
>(h_providers: h_providers): h_providers => h_providers;
