/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { ILocalizedString } from 'vs/platform/action/common/action';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { IResourceRefHandle } from 'vs/platform/userDataSync/common/userDataSync';

export const EDIT_SESSION_SYNC_CATEGORY: ILocalizedString = {
	original: 'Edit Sessions',
	value: localize('session sync', 'Edit Sessions')
};

export const IEditSessionsWorkbenchService = createDecorator<IEditSessionsWorkbenchService>('IEditSessionsWorkbenchService');
export interface IEditSessionsWorkbenchService {
	_serviceBrand: undefined;

	read(ref: string | undefined): Promise<{ ref: string; editSession: EditSession } | undefined>;
	write(editSession: EditSession): Promise<string>;
	delete(ref: string): Promise<void>;
	list(): Promise<IResourceRefHandle[]>;
}

export const IEditSessionsLogService = createDecorator<IEditSessionsLogService>('IEditSessionsLogService');
export interface IEditSessionsLogService extends ILogService { }

export enum ChangeType {
	Addition = 1,
	Deletion = 2,
}

export enum FileType {
	File = 1,
}

interface Addition {
	relativeFilePath: string;
	fileType: FileType.File;
	contents: string;
	type: ChangeType.Addition;
}

interface Deletion {
	relativeFilePath: string;
	fileType: FileType.File;
	contents: undefined;
	type: ChangeType.Deletion;
}

export type Change = Addition | Deletion;

export interface Folder {
	name: string;
	workingChanges: Change[];
}

export const EditSessionSchemaVersion = 1;

export interface EditSession {
	version: number;
	folders: Folder[];
}

export const EDIT_SESSIONS_SIGNED_IN_KEY = 'editSessionsSignedIn';
export const EDIT_SESSIONS_SIGNED_IN = new RawContextKey<boolean>(EDIT_SESSIONS_SIGNED_IN_KEY, false);

export const EDIT_SESSIONS_CONTAINER_ID = 'workbench.view.editSessions';
export const EDIT_SESSIONS_DATA_VIEW_ID = 'workbench.views.editSessions.data';
export const EDIT_SESSIONS_TITLE = localize('edit sessions', 'Edit Sessions');

export const EDIT_SESSIONS_VIEW_ICON = registerIcon('edit-sessions-view-icon', Codicon.cloudDownload, localize('editSessionViewIcon', 'View icon of the edit sessions view.'));

export const EDIT_SESSIONS_SHOW_VIEW = new RawContextKey<boolean>('editSessionsShowView', false);

export const EDIT_SESSIONS_SCHEME = 'vscode-edit-sessions';
