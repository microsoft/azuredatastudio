/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IMessageTreeState {
	readonly focus: string[];
	readonly selection: string[];
	readonly expanded: string[];
	readonly scrollTop: number;
}

export class MessagePanelState {
	public viewState?: IMessageTreeState;

	dispose() {

	}
}
