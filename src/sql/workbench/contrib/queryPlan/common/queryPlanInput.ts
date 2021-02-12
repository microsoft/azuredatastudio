/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, EditorModel, IEditorInput } from 'vs/workbench/common/editor';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILanguageAssociation } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

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
		@IFileService private readonly fileService: IFileService
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
			this._xml = (await this.fileService.readFile(this._uri)).value.toString();
		}
		return null;
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
