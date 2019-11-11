/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

import { ConnectionGroup } from 'sql/base/common/connectionGroup';

export interface IServerGroupDialogCallbacks {
	onAddGroup(groupName: string): void;
	onClose(): void;
}
export const IServerGroupController = createDecorator<IServerGroupController>('serverGroupController');
export interface IServerGroupController {
	_serviceBrand: undefined;
	showCreateGroupDialog(callbacks?: IServerGroupDialogCallbacks): Promise<void>;
	showEditGroupDialog(group: ConnectionGroup): Promise<void>;
}
