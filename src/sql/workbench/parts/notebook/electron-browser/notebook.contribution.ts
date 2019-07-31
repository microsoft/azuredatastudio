/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerComponentType } from 'sql/workbench/parts/notebook/browser/outputs/mimeRegistry';
import { MarkdownOutputComponent } from 'sql/workbench/parts/notebook/electron-browser/outputs/markdownOutput.component';
import { registerCellComponent } from 'sql/platform/notebooks/common/outputRegistry';
import { TextCellComponent } from 'sql/workbench/parts/notebook/electron-browser/cellViews/textCell.component';

/**
 * A mime renderer component for Markdown.
 */
registerComponentType({
	mimeTypes: ['text/markdown'],
	rank: 60,
	safe: true,
	ctor: MarkdownOutputComponent,
	selector: MarkdownOutputComponent.SELECTOR
});

registerCellComponent(TextCellComponent);