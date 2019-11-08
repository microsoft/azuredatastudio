/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, EditorModel } from 'vs/workbench/common/editor';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';

export class QueryPlanInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.queryplan';
	public static SCHEMA: string = 'queryplan';

	private _uniqueSelector: string;
	private _xml: string;

	constructor(
		private _uri: URI, private _connection: ConnectionManagementInfo,
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	public setUniqueSelector(uniqueSelector: string): void {
		this._uniqueSelector = uniqueSelector;
	}

	public getTypeId(): string {
		return UntitledEditorInput.ID;
	}

	public getName(): string {
		return 'Query Plan';
	}

	public get planXml(): string {
		return this._xml;
	}

	public getUri(): string {
		return this._uri.toString();
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public getConnectionProfile(): IConnectionProfile {
		//return this._connection.connectionProfile;
		return undefined;
	}

	public async resolve(refresh?: boolean): Promise<EditorModel> {
		if (!this._xml) {
			this._xml = (await this.fileService.readFile(this._uri)).value.toString();
		}
		return undefined;
	}

	public get hasInitialized(): boolean {
		return !!this._uniqueSelector;
	}

	public get uniqueSelector(): string {
		return this._uniqueSelector;
	}

	public getConnectionInfo(): ConnectionManagementInfo {
		return this._connection;
	}
}
