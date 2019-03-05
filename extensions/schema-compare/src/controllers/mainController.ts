/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { SchemaCompareDialog } from '../dialogs/schemaCompareDialog';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public constructor(context: vscode.ExtensionContext) {
		super(context);
	}
	/**
	 */
	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initializeSchemaCompareDialog();
		return Promise.resolve(true);
	}

	private initializeSchemaCompareDialog() {
		azdata.tasks.registerTask('schemaCompare.start', (profile: azdata.IConnectionProfile) => new SchemaCompareDialog().openDialog(profile));
	}
}
