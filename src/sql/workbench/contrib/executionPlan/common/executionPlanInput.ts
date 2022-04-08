/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { EditorModel } from 'vs/workbench/common/editor/editorModel';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';

export class ExecutionPlanInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.executionplan';
	public static SCHEMA: string = 'executionplan';

	private _content?: string;

	constructor(
		private _uri: URI,
		@ITextFileService private readonly _fileService: ITextFileService,
	) {
		super();
	}

	override get typeId(): string {
		return ExecutionPlanInput.ID;
	}

	public override getName(): string {
		return path.basename(this._uri.fsPath);
	}

	public get content(): string | undefined {
		return this._content;
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
		if (!this._content) {
			this._content = (await this._fileService.read(this._uri, { acceptTextOnly: true })).value;
		}
		return undefined;
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
