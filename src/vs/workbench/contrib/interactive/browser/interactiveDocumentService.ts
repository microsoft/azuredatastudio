/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IInteractiveDocumentService = createDecorator<IInteractiveDocumentService>('IInteractiveDocumentService');

export interface IInteractiveDocumentService {
	readonly _serviceBrand: undefined;
	onWillAddInteractiveDocument: Event<{ notebookUri: URI; inputUri: URI; languageId: string }>;
	onWillRemoveInteractiveDocument: Event<{ notebookUri: URI; inputUri: URI }>;
	willCreateInteractiveDocument(notebookUri: URI, inputUri: URI, languageId: string): void;
	willRemoveInteractiveDocument(notebookUri: URI, inputUri: URI): void;
}

export class InteractiveDocumentService extends Disposable implements IInteractiveDocumentService {
	declare readonly _serviceBrand: undefined;
	private readonly _onWillAddInteractiveDocument = this._register(new Emitter<{ notebookUri: URI; inputUri: URI; languageId: string }>());
	onWillAddInteractiveDocument = this._onWillAddInteractiveDocument.event;
	private readonly _onWillRemoveInteractiveDocument = this._register(new Emitter<{ notebookUri: URI; inputUri: URI }>());
	onWillRemoveInteractiveDocument = this._onWillRemoveInteractiveDocument.event;

	constructor() {
		super();
	}

	willCreateInteractiveDocument(notebookUri: URI, inputUri: URI, languageId: string) {
		this._onWillAddInteractiveDocument.fire({
			notebookUri,
			inputUri,
			languageId
		});
	}

	willRemoveInteractiveDocument(notebookUri: URI, inputUri: URI) {
		this._onWillRemoveInteractiveDocument.fire({
			notebookUri,
			inputUri
		});
	}
}
