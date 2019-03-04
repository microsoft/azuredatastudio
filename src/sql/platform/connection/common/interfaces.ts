/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';

export interface IConnectionProfile extends azdata.IConnectionProfile {
	getOptionsKey(): string;
	matches(profile: azdata.IConnectionProfile): boolean;
}

export interface IConnectionProfileStore {
	options: {};
	groupId: string;
	providerName: string;
	savePassword: boolean;
	id: string;
}

