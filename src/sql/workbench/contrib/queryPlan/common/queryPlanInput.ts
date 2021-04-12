/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageAssociation } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EditorInput, EditorModel, IEditorInput } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';

export class QueryPlanConverter implements ILanguageAssociation {
	static readonly languages = ['sqlplan'];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService
	) { }

	convertInput(activeEditor: IEditorInput): QueryPlanInput | undefined {
		if (activeEditor.resource) {
			return this.instantiationService.createInstance(QueryPlanInput, activeEditor.resource);
		}
		return undefined;
	}

	createBase(activeEditor: QueryPlanInput): IEditorInput {
		return this.editorService.createEditorInput({ resource: activeEditor.resource });
	}
}

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

	public getTypeId(): string {
		return UntitledTextEditorInput.ID;
	}

	public getName(): string {
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

	public async resolve(refresh?: boolean): Promise<EditorModel | null> {
		if (!this._xml) {
			this._xml = (await this.fileService.read(this._uri, { acceptTextOnly: true })).value;
		}
		return null;
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
