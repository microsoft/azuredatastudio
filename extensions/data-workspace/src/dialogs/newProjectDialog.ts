/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DialogBase } from './dialogBase';
import { IWorkspaceService } from '../common/interfaces';
import { NewProjectDialogTitle } from '../common/constants';

export class NewProjectDialog extends DialogBase {
	constructor(public workspaceService: IWorkspaceService) {
		super(NewProjectDialogTitle, 'NewProject');
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		const btn = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: 'test' }).component();
		await view.initializeModel(btn);
	}
}
