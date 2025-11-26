/**
 * # Network Support for Cline
 *
 * ## Development Guidelines
 *
 * **Do** use `import { fetch } from '@/shared/net'` instead of global `fetch`.
 *
 * Global `fetch` will appear to work in VSCode, but proxy support will be
 * broken in JetBrains or CLI.
 *
 * If you use Axios, **do** call `getAxiosSettings()` and spread into
 * your Axios configuration:
 *
 * ```typescript
 * import { getAxiosSettings } from '@/shared/net'
 * await axios.get(url, {
 *   headers: { 'X-FOO': 'BAR' },
 *   ...getAxiosSettings()
 * })
 * ```
 *
 * **Do** remember to pass our `fetch` into your API clients:
 *
 * ```typescript
 * import OpenAI from "openai"
 * import { fetch } from "@/shared/net"
 * this.client = new OpenAI({
 *   apiKey: '...',
 *   fetch, // Use configured fetch with proxy support
 * })
 * ```
 *
 * If you neglect this step, inference won't work in JetBrains and CLI
 * through proxies.
 *
 * ## Proxy Support
 *
 * Cline uses platform-specific fetch implementations to handle proxy
 * configuration:
 * - **VSCode**: Uses global fetch (VSCode provides proxy configuration)
 * - **JetBrains, CLI**: Uses undici fetch with explicit ProxyAgent
 *
 * Proxy configuration via standard environment variables:
 * - `http_proxy` / `HTTP_PROXY` - Proxy for HTTP requests
 * - `https_proxy` / `HTTPS_PROXY` - Proxy for HTTPS requests
 * - `no_proxy` / `NO_PROXY` - Comma-separated list of hosts to bypass proxy
 *
 * **Supported proxy protocols**:
 * - HTTP proxies: `http://proxy.example:3128`
 * - HTTPS proxies: `https://proxy.example:3128`
 * - SOCKS4 proxies: `socks4://proxy.example:1080`
 * - SOCKS5 proxies: `socks5://proxy.example:1080`
 * - SOCKS proxies (auto-detect version): `socks://proxy.example:1080`
 *
 * Note: The proxy URL MUST specify the protocol. Simply specifying
 * the proxy hostname (e.g., `proxy.example:3128`) will result in errors.
 * Always include the protocol prefix.
 *
 * ## Certificate Trust
 *
 * Proxies often machine-in-the-middle HTTPS connections. To make this work,
 * they generate self-signed certificates for a host, and the client is
 * configured to trust the proxy as a certificate authority.
 *
 * VSCode transparently pulls trusted certificates from the operating system
 * and configures node trust.
 *
 * JetBrains exports trusted certificates from the OS and writes them to a
 * temporary file, then configures node TLS by setting NODE_EXTRA_CA_CERTS.
 *
 * CLI users should set the NODE_EXTRA_CA_CERTS environment variable if
 * necessary, because node does not automatically use the OS' trusted certs.
 *
 * ## Limitations in JetBrains & CLI
 *
 * - Proxy settings are static at startup--restart required for changes
 * - PAC files not supported
 * - Proxy authentication via env vars only
 * - When using SOCKS proxies, the same proxy is used for both HTTP and HTTPS
 *   (the first SOCKS proxy found in https_proxy or http_proxy is used)
 *
 * These are not fundamental limitations, they just need integration work.
 *
 * ## Troubleshooting
 *
 * 1. Verify proxy env vars: `echo $http_proxy $https_proxy`
 * 2. Check certificates: `echo $NODE_EXTRA_CA_CERTS` (should point to PEM file)
 * 3. View logs: Check ~/.cline/cline-core-service.log for network-related
 *    failures.
 * 4. Test connection: Use `curl -x host:port` etc. to isolate proxy
 *    configuration versus client issues.
 *
 * @example
 * ```typescript
 * // Good - uses configured fetch
 * import { fetch } from '@/shared/net'
 * const response = await fetch(url)
 *
 * // Good - configures axios to use configured fetch
 * import { getAxiosSettings } from '@/shared/net'
 * await axios.get(url, { ...getAxiosSettings() })
 * ```
 */

import { EnvHttpProxyAgent, ProxyAgent, fetch as undiciFetch } from "undici"

let mockFetch: typeof globalThis.fetch | undefined
let configuredDispatcher: ProxyAgent | EnvHttpProxyAgent | undefined

/**
 * Platform-configured fetch that respects proxy settings.
 * Use this instead of global fetch to ensure proper proxy configuration.
 *
 * @example
 * ```typescript
 * import { fetch } from '@/shared/net'
 * const response = await fetch('https://api.example.com')
 * ```
 */
export const fetch: typeof globalThis.fetch = (() => {
	// Note: Don't use Logger here; it may not be initialized.

	let baseFetch: typeof globalThis.fetch = globalThis.fetch

	try {
		// Check for SOCKS proxy in environment variables
		const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY
		const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY
		const proxy = httpsProxy || httpProxy

		if (proxy) {
			const proxyUrl = new URL(proxy)
			const protocol = proxyUrl.protocol.replace(":", "")

			// Use ProxyAgent for SOCKS proxies (required in both VSCode and standalone)
			// VSCode's global fetch doesn't support SOCKS, so we must use undici
			if (protocol === "socks" || protocol === "socks4" || protocol === "socks5") {
				console.log(`[net] Configuring SOCKS proxy: ${protocol}://${proxyUrl.host}`)
				configuredDispatcher = new ProxyAgent({
					uri: proxy,
					// ProxyAgent handles SOCKS protocols directly
				})
				baseFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
					return undiciFetch(input as any, { ...init, dispatcher: configuredDispatcher } as any) as any
				}
			} else if (protocol === "http" || protocol === "https") {
				// For HTTP/HTTPS proxies in standalone mode, use EnvHttpProxyAgent
				// In VSCode, use global fetch (VSCode handles HTTP/HTTPS proxies)
				if (process.env.IS_STANDALONE) {
					console.log(`[net] Configuring HTTP/HTTPS proxy from environment variables`)
					configuredDispatcher = new EnvHttpProxyAgent()
					baseFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
						return undiciFetch(input as any, { ...init, dispatcher: configuredDispatcher } as any) as any
					}
				}
				// else: keep using globalThis.fetch in VSCode for HTTP/HTTPS
			} else {
				console.warn(`[net] Unsupported proxy protocol: ${protocol}, using default fetch`)
			}
		} else if (process.env.IS_STANDALONE) {
			// No proxy configured in standalone mode, use undici fetch without proxy
			baseFetch = undiciFetch as any as typeof globalThis.fetch
		}
		// else: No proxy in VSCode, keep using globalThis.fetch
	} catch (error) {
		// If proxy configuration fails, fall back appropriately
		console.warn("Failed to configure proxy agent, using default fetch:", error)
		if (process.env.IS_STANDALONE) {
			baseFetch = undiciFetch as any as typeof globalThis.fetch
		}
	}

	return (input: string | URL | Request, init?: RequestInit): Promise<Response> => (mockFetch || baseFetch)(input, init)
})()

/**
 * Mocks `fetch` for testing and calls `callback`. Then restores `fetch`. If the
 * specified callback returns a Promise, the fetch is restored when that Promise
 * is settled.
 * @param theFetch the replacement function to call to implement `fetch`.
 * @param callback `fetch` will be mocked for the duration of `callback()`.
 * @returns the result of `callback()`.
 */
export function mockFetchForTesting<T>(theFetch: typeof globalThis.fetch, callback: () => T): T {
	const originalMockFetch = mockFetch
	mockFetch = theFetch
	let willResetSync = true
	try {
		const result = callback()
		if (result instanceof Promise) {
			willResetSync = false
			return result.finally(() => {
				mockFetch = originalMockFetch
			}) as typeof result
		} else {
			return result
		}
	} finally {
		if (willResetSync) {
			mockFetch = originalMockFetch
		}
	}
}

/**
 * Returns axios configuration for proper proxy support.
 *
 * For SOCKS proxies or standalone mode, uses fetch adapter with our configured fetch.
 * For VSCode with HTTP/HTTPS proxies, uses default http adapter (which VSCode configures).
 *
 * @returns Configuration object with appropriate adapter and settings
 *
 * @example
 * ```typescript
 * const response = await axios.get(url, {
 *   headers: { Authorization: 'Bearer token' },
 *   timeout: 5000,
 *   ...getAxiosSettings()
 * })
 * ```
 */
export function getAxiosSettings(): { adapter?: any; fetch?: typeof globalThis.fetch; dispatcher?: any } {
	try {
		// Check for proxy configuration
		const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY
		const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY
		const proxy = httpsProxy || httpProxy

		// Determine if we need fetch adapter
		let needsFetchAdapter = false
		let isSocksProxy = false

		if (proxy) {
			try {
				const proxyUrl = new URL(proxy)
				const protocol = proxyUrl.protocol.replace(":", "")

				// SOCKS proxies MUST use fetch adapter with our configured fetch
				if (protocol === "socks" || protocol === "socks4" || protocol === "socks5") {
					console.log(`[net] Axios using SOCKS proxy via fetch adapter: ${protocol}://${proxyUrl.host}`)
					needsFetchAdapter = true
					isSocksProxy = true
				}
			} catch (error) {
				console.warn("[net] Failed to parse proxy URL:", error)
			}
		}

		// In standalone mode, always use fetch adapter
		if (process.env.IS_STANDALONE) {
			console.log("[net] Axios using fetch adapter in standalone mode")
			needsFetchAdapter = true
		}

		if (needsFetchAdapter) {
			// Use fetch adapter with our configured fetch (which has proxy support)
			return {
				adapter: "fetch" as any,
				fetch, // Our configured fetch with ProxyAgent or EnvHttpProxyAgent
			}
		}

		// In VSCode without SOCKS proxy, use default http adapter
		// VSCode will automatically configure the proxy for the http adapter
		console.log("[net] Axios using default http adapter (VSCode proxy support)")
		return {}
	} catch (error) {
		console.warn("Failed to configure axios settings, using default:", error)
		return {}
	}
}
