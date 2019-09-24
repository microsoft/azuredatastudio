/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { IWindowsService } from 'vs/platform/windows/common/windows';
//tslint:disable-next-line:layering
import { IElectronService } from 'vs/platform/electron/node/electron';

export class ShowFileInFolderAction extends Action {

	constructor(private path: string, label: string, @IElectronService private readonly electronService: IElectronService) {
		super('showItemInFolder.action.id', label);
	}

	run(): Promise<void> {
		return this.electronService.showItemInFolder(this.path);
	}
}

export class OpenFileInFolderAction extends Action {

	constructor(private path: string, label: string, @IWindowsService private readonly windowsService: IWindowsService) {
		super('showItemInFolder.action.id', label);
	}

	run() {
		return this.windowsService.openExternal(this.path);
	}
}
