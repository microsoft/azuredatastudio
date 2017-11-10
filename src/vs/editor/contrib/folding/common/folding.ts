/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorContribution } from 'vs/editor/common/editorCommon';

export const ID = 'editor.contrib.folding';

export interface IFoldingController extends IEditorContribution {

	foldAll(): void;
	unfoldAll(): void;

}