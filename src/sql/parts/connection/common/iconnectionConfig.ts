/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionProfile } from './interfaces';
import { IConnectionProfileGroup, ConnectionProfileGroup } from './connectionProfileGroup';
import { ConnectionProfile } from './connectionProfile';
import * as sqlops from 'sqlops';

/**
 * Interface for a configuration file that stores connection profiles.
 *
 * @export
 * @interface IConnectionConfig
 */
export interface IConnectionConfig {
	addConnection(profile: IConnectionProfile): Promise<IConnectionProfile>;
	addGroup(profileGroup: IConnectionProfileGroup): Promise<string>;
	getConnections(getWorkspaceConnections: boolean): ConnectionProfile[];
	getAllGroups(): IConnectionProfileGroup[];
	changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void>;
	changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void>;
	setCachedMetadata(cachedMetaData: sqlops.DataProtocolServerCapabilities[]): void;
	getCapabilities(providerName: string): sqlops.DataProtocolServerCapabilities;
	editGroup(group: ConnectionProfileGroup): Promise<void>;
	deleteConnection(profile: ConnectionProfile): Promise<void>;
	deleteGroup(group: ConnectionProfileGroup): Promise<void>;
	canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean;
}
