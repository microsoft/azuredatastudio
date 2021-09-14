/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { INotebookRendererMessagingService, IScopedRendererMessaging } from 'vs/workbench/contrib/notebook/common/notebookRendererMessagingService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

type MessageToSend = { editorId: string; rendererId: string; message: unknown };

export class NotebookRendererMessagingService implements INotebookRendererMessagingService {
	declare _serviceBrand: undefined;
	/**
	 * Activation promises. Maps renderer IDs to a queue of messages that should
	 * be sent once activation finishes, or undefined if activation is complete.
	 */
	private readonly activations = new Map<string /* rendererId */, undefined | MessageToSend[]>();
	private readonly receiveMessageEmitter = new Emitter<{ editorId: string; rendererId: string, message: unknown }>();
	public readonly onDidReceiveMessage = this.receiveMessageEmitter.event;
	private readonly postMessageEmitter = new Emitter<MessageToSend>();
	public readonly onShouldPostMessage = this.postMessageEmitter.event;

	constructor(@IExtensionService private readonly extensionService: IExtensionService) { }

	/** @inheritdoc */
	public fireDidReceiveMessage(editorId: string, rendererId: string, message: unknown): void {
		this.receiveMessageEmitter.fire({ editorId, rendererId, message });
	}

	/** @inheritdoc */
	public prepare(rendererId: string) {
		if (this.activations.has(rendererId)) {
			return;
		}

		const queue: MessageToSend[] = [];
		this.activations.set(rendererId, queue);

		this.extensionService.activateByEvent(`onRenderer:${rendererId}`).then(() => {
			for (const message of queue) {
				this.postMessageEmitter.fire(message);
			}

			this.activations.set(rendererId, undefined);
		});
	}

	/** @inheritdoc */
	public getScoped(editorId: string): IScopedRendererMessaging {
		return {
			onDidReceiveMessage: Event.filter(this.onDidReceiveMessage, e => e.editorId === editorId),
			postMessage: (rendererId, message) => this.postMessage(editorId, rendererId, message),
		};
	}

	private postMessage(editorId: string, rendererId: string, message: unknown): void {
		if (!this.activations.has(rendererId)) {
			this.prepare(rendererId);
		}

		const activation = this.activations.get(rendererId);
		const toSend = { rendererId, editorId, message };
		if (activation === undefined) {
			this.postMessageEmitter.fire(toSend);
		} else {
			activation.push(toSend);
		}
	}
}
