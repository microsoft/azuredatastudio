import { ClientCapabilities as VSClientCapabilities } from 'vscode-languageclient';

export interface ConnectionClientCapabilities {
	connection?: {
		/**
		 * Whether the connection support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	backup?: {
		/**
		 * Whether the backup support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	restore?: {
		/**
		 * Whether the restore support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	query?: {
		/**
		 * Whether the query support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	objectExplorer?: {
		/**
		 * Whether the object explorer support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	scripting?: {

		/**
		 * Whether the scripting support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	taskServices?: {
		/**
		 * Whether the task services support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	fileBrowser?: {
		/**
		 * Whether the file browser support dynamic registration
		 */
		dynamicRegistration?: boolean;
	},
	profiler?: {
		/**
		 * Whether the profiler support dynamic registration
		 */
		dynamicRegistration?: boolean;
	}
}

export interface ClientCapabilities extends VSClientCapabilities {
	connection?: ConnectionClientCapabilities;
}
