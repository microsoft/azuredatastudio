/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { EncodingMode } from 'vs/workbench/services/textfile/common/textfiles';
import { GroupIdentifier, ISaveOptions, IEditorInput } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/browser/fileQueryEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { EditorInputCapabilities } from 'vs/workbench/common/editor';
import { UNTITLED_QUERY_EDITOR_TYPEID } from 'sql/workbench/common/constants';
import { IUntitledQueryEditorInput } from 'sql/base/query/common/untitledQueryEditorInput';

export class UntitledQueryEditorInput extends QueryEditorInput implements IUntitledQueryEditorInput {

	public static readonly ID = UNTITLED_QUERY_EDITOR_TYPEID;

	constructor(
		description: string | undefined,
		text: UntitledTextEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService);
	}

	public override resolve(): Promise<IUntitledTextEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public override get text(): UntitledTextEditorInput {
		return this._text as UntitledTextEditorInput;
	}

	public get hasAssociatedFilePath(): boolean {
		return this.text.model.hasAssociatedFilePath;
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		let preProcessed = await this.text.save(group, options);
		let newUri = preProcessed.resource.toString(true);
		this._results.uri = newUri;
		await this.changeConnectionUri(newUri);
		let newInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (preProcessed as FileEditorInput), this.results);
		newInput.state.setState(this.state);
		return newInput;
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		let preProcessed = await this.text.saveAs(group, options);
		let newUri = preProcessed.resource.toString(true);
		this._results.uri = newUri;
		await this.changeConnectionUri(newUri);
		let newInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (preProcessed as FileEditorInput), this.results);
		newInput.state.setState(this.state);
		return newInput;
	}

	public setMode(mode: string): void {
		this.text.setMode(mode);
	}

	public getMode(): string | undefined {
		return this.text.getMode();
	}

	override get typeId(): string {
		return UntitledQueryEditorInput.ID;
	}

	public getEncoding(): string | undefined {
		return this.text.getEncoding();
	}

	public setEncoding(encoding: string, mode: EncodingMode): Promise<void> {
		return this.text.setEncoding(encoding, mode);
	}

	override get capabilities(): EditorInputCapabilities {
		// Subclasses need to explicitly opt-in to being untitled.
		return EditorInputCapabilities.Untitled;
	}
}
