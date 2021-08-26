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
import { EncodingMode, IEncodingSupport } from 'vs/workbench/services/textfile/common/textfiles';
import { EditorInputCapabilities } from 'vs/workbench/common/editor';

export class UntitledQueryEditorInput extends QueryEditorInput implements IEncodingSupport {

	public static readonly ID = 'workbench.editorInput.untitledQueryInput';

	constructor(
		description: string | undefined,
		text: UntitledTextEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService
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
