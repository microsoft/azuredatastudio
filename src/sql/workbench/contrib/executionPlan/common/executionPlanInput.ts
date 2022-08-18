/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { EditorModel } from 'vs/workbench/common/editor/editorModel';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import * as azdata from 'azdata';

export class ExecutionPlanInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.executionplan';
	public static SCHEMA: string = 'executionplan';
	private readonly editorNamePrefix = localize('epCompare.executionPlanEditorName', 'ExecutionPlan');
	private _editorName: string;

	public _executionPlanFileViewUUID: string;

	constructor(
		private _uri: URI | undefined,
		private executionPlanGraphinfo: azdata.executionPlan.ExecutionPlanGraphInfo,
		@ITextFileService private readonly _fileService: ITextFileService,
		@IEditorService private readonly _editorService: IEditorService
	) {
		super();

		if (this._uri === undefined && !!this.executionPlanGraphinfo.graphFileContent && !!this.executionPlanGraphinfo.graphFileType) {
			const existingNames = this._editorService.editors.map(editor => editor.getName());
			let i = 0;
			this._editorName = `${this.editorNamePrefix}${i}.${this.executionPlanGraphinfo.graphFileType}`;
			while (existingNames.includes(this._editorName)) {
				i++;
				this._editorName = `${this.editorNamePrefix}${i}.${this.executionPlanGraphinfo.graphFileType}`;
			}

			this._uri = URI.parse(this._editorName);
		}
	}

	public get executionPlanFileViewUUID(): string {
		return this._executionPlanFileViewUUID;
	}

	public set executionPlanFileViewUUID(v: string) {
		this._executionPlanFileViewUUID = v;
	}

	override get typeId(): string {
		return ExecutionPlanInput.ID;
	}

	public override getName(): string {
		if (this._editorName) {
			return this._editorName;
		}

		return path.basename(this._uri.fsPath);
	}

	public async content(): Promise<string> {
		if (!this.executionPlanGraphinfo.graphFileContent) {
			this.executionPlanGraphinfo.graphFileContent = (await this._fileService.read(this._uri, { acceptTextOnly: true })).value;
		}
		return this.executionPlanGraphinfo.graphFileContent;
	}

	public getUri(): string {
		return this._uri.toString();
	}

	public getFileExtension(): string {
		return path.extname(this._uri.fsPath);
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public override async resolve(refresh?: boolean): Promise<EditorModel | undefined> {
		if (!this.executionPlanGraphinfo.graphFileContent) {
			this.executionPlanGraphinfo.graphFileContent = (await this._fileService.read(this._uri, { acceptTextOnly: true })).value;
		}
		return undefined;
	}

	get resource(): URI | undefined {
		return URI.from({
			scheme: ExecutionPlanInput.SCHEMA,
			path: 'execution-plan'
		});
	}
}
