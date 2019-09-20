/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { IWindowsService } from 'vs/platform/windows/common/windows';
//tslint:disable-next-line:layering
import { ElectronMainService } from 'vs/platform/electron/electron-main/electronMainService';

export class ShowFileInFolderAction extends Action {

	constructor(private path: string, label: string, private windowsService: ElectronMainService) {
		super('showItemInFolder.action.id', label);
	}

	run(): Promise<void> {
		return this.windowsService.showItemInFolder(this.path);
	}
}

export class OpenFileInFolderAction extends Action {

	constructor(private path: string, label: string, private windowsService: IWindowsService) {
		super('showItemInFolder.action.id', label);
	}

	run() {
		return this.windowsService.openExternal(this.path);
	}
}
