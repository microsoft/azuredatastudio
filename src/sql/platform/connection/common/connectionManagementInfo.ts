/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import * as azdata from 'azdata';
import { StopWatch } from 'vs/base/common/stopwatch';

/**
 * Information for a document's connection. Exported for testing purposes.
 */
export interface ConnectionManagementInfo {
	/**
	 * Connection GUID returned from the service host
	 */
	connectionId?: string;

	providerId: string;

	/**
	 * Credentials used to connect
	 */
	connectionProfile: ConnectionProfile;

	/**
	 * Callback for when a connection notification is received.
	 */
	connectHandler?: (result: boolean, errorMessage?: string, errorCode?: number, callStack?: string) => void;

	/**
	 * Timer for tracking extension connection time.
	 */
	extensionTimer: StopWatch;

	/**
	 * Timer for tracking service connection time.
	 */
	serviceTimer: StopWatch;

	/**
	 * Timer for tracking intelliSense activation time.
	 */
	intelliSenseTimer: StopWatch;

	/**
	 * Whether the connection is in the process of connecting.
	 */
	connecting: boolean;

	/**
	 * Whether the connection should be deleted after connection is complete.
	 */
	deleted?: boolean;

	/**
	 * Information about the connected server.
	 */
	serverInfo?: azdata.ServerInfo;

	/**
	 * Owner uri assigned to the connection
	 */
	ownerUri: string;
}
