/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerTextEditor } from 'sql/base/browser/ui/designer/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// TODO: Implement the text editor
export class TableDesignerTextEditor implements DesignerTextEditor {
	private _content: string;
	private _readonly: boolean;
	private _contentChangeEventEmitter: Emitter<string> = new Emitter<string>();
	readonly onDidContentChange: Event<string> = this._contentChangeEventEmitter.event;

	constructor(container: HTMLElement, @IInstantiationService instantiationService: IInstantiationService) {
	}

	get content(): string {
		return this._content;
	}

	set content(val: string) {
		this._content = val;
	}

	get readonly(): boolean {
		return this._readonly;
	}

	set readonly(val: boolean) {
		this._readonly = val;
	}
}
