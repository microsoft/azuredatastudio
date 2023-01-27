/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { DialogBase } from './dialogBase';
import * as ObjectManagement from '../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class ServerRoleDialog extends DialogBase {
	protected initialize(): void {
		const tab = azdata.window.createTab('');
		tab.registerContent(async view => {
			const name = view.modelBuilder.text().component();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).withItems([name]).component(),
						title: ''
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			return view.initializeModel(form)
		});
		this._dialogObject.content = [tab];
	}
	constructor(serverRole: ObjectManagement.ServerRole) {
		super(localize('mssql.ServerRoleDialogTitle', 'Server Role'), 'ServerRole')
	}

}
