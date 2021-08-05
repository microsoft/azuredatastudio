/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { GroupIdentifier, ISaveOptions, IEditorInput } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/common/fileQueryEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class TitledQueryEditorInput extends QueryEditorInput {

	public static readonly ID = 'workbench.editorInput.TitledQueryInput';

	constructor(
		description: string,
		text: FileEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService);
	}

	override get typeId(): string {
		return TitledQueryEditorInput.ID;
	}


	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		//return this.text.save(group, options);
		let preProcessed = await this.text.saveAs(group, options);
		let newFileQueryInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (preProcessed as any), this._results);
		newFileQueryInput.state.resultsVisible = this.state.resultsVisible;
		newFileQueryInput.state.isSaving = true;
		newFileQueryInput.state.oldUri = this.uri;
		//need to find way to add URIs into input.
		return newFileQueryInput;
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		//return this.text.saveAs(group, options);
		let preProcessed = await this.text.saveAs(group, options);
		let newFileQueryInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (preProcessed as any), this._results);
		newFileQueryInput.state.resultsVisible = this.state.resultsVisible;
		newFileQueryInput.state.isSaving = true;
		newFileQueryInput.state.oldUri = this.uri;
		//need to find way to add URIs into input.
		return newFileQueryInput;
	}
}
