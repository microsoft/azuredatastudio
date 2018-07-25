/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { ImportDataModel } from './dataModel';

export async function summary(view: sqlops.ModelView, model: ImportDataModel) : Promise<void> {
	//from services sample placeholder code
	let formWrapper = view.modelBuilder.loadingComponent().component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}