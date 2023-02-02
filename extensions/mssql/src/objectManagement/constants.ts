/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LoginTypeDisplayName, LoginTypeDisplayNameInTitle, UserTypeDisplayName, UserTypeDisplayNameInTitle } from './localizedConstants';

/**
 * The object types in object explorer's node context.
 */
export enum NodeType {
	Login = 'ServerLevelLogin',
	DatabaseUser = 'DatabaseUser'
}

export function getNodeTypeDisplayName(type: string, inTitle: boolean = false): string {
	switch (type) {
		case NodeType.Login:
			return inTitle ? LoginTypeDisplayNameInTitle : LoginTypeDisplayName;
		case NodeType.DatabaseUser:
			return inTitle ? UserTypeDisplayNameInTitle : UserTypeDisplayName;
		default:
			throw new Error(`Unkown node type: ${type}`);
	}
}
