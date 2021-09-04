/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { EditorInput, EditorModel } from 'vs/workbench/common/editor';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';

export class QueryPlanInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.queryplan';
	public static SCHEMA: string = 'queryplan';

	private _xml?: string;

	constructor(
		private _uri: URI,
		@ITextFileService private readonly fileService: ITextFileService
	) {
		super();
	}

	override get typeId(): string {
		return UntitledTextEditorInput.ID;
	}

	public override getName(): string {
		return 'Query Plan';
	}

	public get planXml(): string | undefined {
		return this._xml;
	}

	public getUri(): string {
		return this._uri.toString();
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public override async resolve(refresh?: boolean): Promise<EditorModel | null> {
		if (!this._xml) {
			this._xml = (await this.fileService.read(this._uri, { acceptTextOnly: true })).value;
		}
		return null;
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
