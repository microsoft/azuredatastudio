/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';

export interface IConnectionProfile extends sqlops.IConnectionProfile {
	getOptionsKey(): string;
	matches(profile: sqlops.IConnectionProfile): boolean;
}

export interface IConnectionProfileStore {
	options: {};
	groupId: string;
	providerName: string;
	savePassword: boolean;
	id: string;
}

