/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import { ProjectProviderRegistry } from './common/projectProviderRegistry';

export class DataWorkspaceExtension implements dataworkspace.IExtension {
	registerProjectProvider(provider: dataworkspace.IProjectProvider): vscode.Disposable {
		return ProjectProviderRegistry.registerProvider(provider);
	}
}
