/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectableInput } from 'sql/platform/connection/common/connectionManagement';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { EditorInputCapabilities, IEditorInput } from 'vs/workbench/common/editor';
import { EncodingMode } from 'vs/workbench/services/textfile/common/textfiles';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';

export interface IUntitledQueryEditorInput extends IEditorInput, IConnectableInput {

	resolve(): Promise<IUntitledTextEditorModel & IResolvedTextEditorModel>;

	text: UntitledTextEditorInput;

	hasAssociatedFilePath: boolean;

	setMode(mode: string): void

	getMode(): string | undefined;

	typeId: string;

	getEncoding(): string | undefined;

	setEncoding(encoding: string, mode: EncodingMode): Promise<void>

	capabilities: EditorInputCapabilities
}
