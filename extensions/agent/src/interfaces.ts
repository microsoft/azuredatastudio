/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export enum AgentDialogMode {
	CREATE = 1,
	EDIT = 2,
	VIEW = 3
}

export interface IAgentDialogData {
	dialogMode: AgentDialogMode;
	initialize(): void;
	save(): Promise<void>;
}
