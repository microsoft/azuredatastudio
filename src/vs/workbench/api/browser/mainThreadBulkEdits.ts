/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer, decodeBase64 } from 'vs/base/common/buffer';
import { revive } from 'vs/base/common/marshalling';
import { IBulkEditService, ResourceFileEdit, ResourceTextEdit } from 'vs/editor/browser/services/bulkEditService';
import { WorkspaceEdit } from 'vs/editor/common/languages';
import { ILogService } from 'vs/platform/log/common/log';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { IWorkspaceEditDto, MainContext, MainThreadBulkEditsShape } from 'vs/workbench/api/common/extHost.protocol';
import { ResourceNotebookCellEdit } from 'vs/workbench/contrib/bulkEdit/browser/bulkCellEdits';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';


@extHostNamedCustomer(MainContext.MainThreadBulkEdits)
export class MainThreadBulkEdits implements MainThreadBulkEditsShape {

	constructor(
		_extHostContext: IExtHostContext,
		@IBulkEditService private readonly _bulkEditService: IBulkEditService,
		@ILogService private readonly _logService: ILogService,
		@IUriIdentityService private readonly _uriIdentService: IUriIdentityService
	) { }

	dispose(): void { }

	$tryApplyWorkspaceEdit(dto: IWorkspaceEditDto, undoRedoGroupId?: number, isRefactoring?: boolean): Promise<boolean> {
		const edits = reviveWorkspaceEditDto(dto, this._uriIdentService);
		return this._bulkEditService.apply(edits, { undoRedoGroupId, respectAutoSaveConfig: isRefactoring }).then((res) => res.isApplied, err => {
			this._logService.warn(`IGNORING workspace edit: ${err}`);
			return false;
		});
	}
}

export function reviveWorkspaceEditDto(data: IWorkspaceEditDto, uriIdentityService: IUriIdentityService, resolveDataTransferFile?: (id: string) => Promise<VSBuffer>): WorkspaceEdit;
export function reviveWorkspaceEditDto(data: IWorkspaceEditDto | undefined, uriIdentityService: IUriIdentityService, resolveDataTransferFile?: (id: string) => Promise<VSBuffer>): WorkspaceEdit | undefined;
export function reviveWorkspaceEditDto(data: IWorkspaceEditDto | undefined, uriIdentityService: IUriIdentityService, resolveDataTransferFile?: (id: string) => Promise<VSBuffer>): WorkspaceEdit | undefined {
	if (!data || !data.edits) {
		return <WorkspaceEdit>data;
	}
	const result = revive<WorkspaceEdit>(data);
	for (const edit of result.edits) {
		if (ResourceTextEdit.is(edit)) {
			edit.resource = uriIdentityService.asCanonicalUri(edit.resource);
		}
		if (ResourceFileEdit.is(edit)) {
			if (edit.options) {
				const inContents = (edit as any).options?.contents;
				if (inContents) {
					if (inContents.type === 'base64') {
						edit.options.contents = Promise.resolve(decodeBase64(inContents.value));
					} else {
						if (resolveDataTransferFile) {
							edit.options.contents = resolveDataTransferFile(inContents.id);
						} else {
							throw new Error('Could not revive data transfer file');
						}
					}
				}
			}
			edit.newResource = edit.newResource && uriIdentityService.asCanonicalUri(edit.newResource);
			edit.oldResource = edit.oldResource && uriIdentityService.asCanonicalUri(edit.oldResource);
		}
		if (ResourceNotebookCellEdit.is(edit)) {
			edit.resource = uriIdentityService.asCanonicalUri(edit.resource);
		}
	}
	return <WorkspaceEdit>data;
}
