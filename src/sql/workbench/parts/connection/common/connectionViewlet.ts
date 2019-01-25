/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IViewlet } from 'vs/workbench/common/viewlet';

export interface IConnectionsViewlet extends IViewlet {
	search(text: string): void;
}
