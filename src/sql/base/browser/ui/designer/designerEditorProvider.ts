/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DesignerEditor } from 'sql/base/browser/ui/designer/designerEditor';
import { DesignerEditorProvider } from 'sql/base/browser/ui/designer/interfaces';
import { Emitter, Event } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class TableDesignerEditorProvider implements DesignerEditorProvider {

	private _designerEditor: DesignerEditor;
	private _onTextChanged = new Emitter<string>();
	private _enabled: boolean = true;
	public readonly onTextChanged: Event<string> = this._onTextChanged.event;

	constructor(designerEditor: DesignerEditor) {
		this._designerEditor = designerEditor;
	}

	public init(container: HTMLElement): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this._designerEditor.create(container);
				this._designerEditor.setVisible(this._enabled);
				resolve();
			} catch (e) {
				reject(e);
			}
		});
	}

	public setValue(input: string, enabled: boolean): Promise<void> {
		return new Promise((resolve, reject) => {
			return;
		})
	}

	public layout(dimension: DOM.Dimension): void {
		this._designerEditor.layout(dimension);
	}

}
