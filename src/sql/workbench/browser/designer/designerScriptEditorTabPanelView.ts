/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DesignerScriptEditor } from 'sql/workbench/browser/designer/designerScriptEditor';

export class DesignerScriptEditorTabPanelView extends Disposable implements IPanelView {
	private _textEditor: DesignerScriptEditor;

	constructor(private _instantiationService: IInstantiationService) {
		super();
	}

	render(container: HTMLElement): void {
		this._textEditor = this._instantiationService.createInstance(DesignerScriptEditor, container);
	}

	layout(dimension: DOM.Dimension): void {
		this._textEditor.layout(dimension);
	}

	set content(content: string) {
		if (this._textEditor) {
			this._textEditor.content = content;
		}
	}
}
