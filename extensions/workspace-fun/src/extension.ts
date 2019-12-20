/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as commands from './commands';
import * as fileSystems from './fileSystemProviders';

export function activate() {
	commands.AddDataWorkspaceCommand.register();
	commands.AddFolderCommand.register();
	commands.AddJsonCommand.register();
	commands.AddConnectionsToWorkspaceCommand.register();
	fileSystems.JSONFileSystemProvider.register();
	fileSystems.DataWorkspaceFileProvider.register();
}
