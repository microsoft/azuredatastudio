/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { TPromise } from 'vs/base/common/winjs.base';
import { Builder, $ } from 'vs/base/browser/builder';
import { EditorInput, EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { BinaryEditorModel } from 'vs/workbench/common/editor/binaryEditorModel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ResourceViewerContext, ResourceViewer } from 'vs/workbench/browser/parts/editor/resourceViewer';
import URI from 'vs/base/common/uri';
import { Dimension } from 'vs/base/browser/dom';
import { IFileService } from 'vs/platform/files/common/files';
import { CancellationToken } from 'vs/base/common/cancellation';

export interface IOpenCallbacks {
	openInternal: (input: EditorInput, options: EditorOptions) => void;
	openExternal: (uri: URI) => void;
}

/*
 * This class is only intended to be subclassed and not instantiated.
 */
export abstract class BaseBinaryResourceEditor extends BaseEditor {

	private readonly _onMetadataChanged: Emitter<void> = this._register(new Emitter<void>());
	get onMetadataChanged(): Event<void> { return this._onMetadataChanged.event; }

	private callbacks: IOpenCallbacks;
	private metadata: string;
	private binaryContainer: Builder;
	private scrollbar: DomScrollableElement;
	private resourceViewerContext: ResourceViewerContext;

	constructor(
		id: string,
		callbacks: IOpenCallbacks,
		telemetryService: ITelemetryService,
		themeService: IThemeService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super(id, telemetryService, themeService);

		this.callbacks = callbacks;
	}

	getTitle(): string {
		return this.input ? this.input.getName() : nls.localize('binaryEditor', "Binary Viewer");
	}

	protected createEditor(parent: HTMLElement): void {

		// Container for Binary
		const binaryContainerElement = document.createElement('div');
		binaryContainerElement.className = 'binary-container';
		this.binaryContainer = $(binaryContainerElement);
		this.binaryContainer.style('outline', 'none');
		this.binaryContainer.tabindex(0); // enable focus support from the editor part (do not remove)

		// Custom Scrollbars
		this.scrollbar = this._register(new DomScrollableElement(binaryContainerElement, { horizontal: ScrollbarVisibility.Auto, vertical: ScrollbarVisibility.Auto }));
		parent.appendChild(this.scrollbar.getDomNode());
	}

	setInput(input: EditorInput, options: EditorOptions, token: CancellationToken): Thenable<void> {
		return super.setInput(input, options, token).then(() => {
			return input.resolve().then(model => {

				// Check for cancellation
				if (token.isCancellationRequested) {
					return void 0;
				}

				// Assert Model instance
				if (!(model instanceof BinaryEditorModel)) {
					return TPromise.wrapError<void>(new Error('Unable to open file as binary'));
				}

				// Render Input
				this.resourceViewerContext = ResourceViewer.show(
					{ name: model.getName(), resource: model.getResource(), size: model.getSize(), etag: model.getETag(), mime: model.getMime() },
					this._fileService,
					this.binaryContainer.getHTMLElement(),
					this.scrollbar,
					resource => this.callbacks.openInternal(input, options),
					resource => this.callbacks.openExternal(resource),
					meta => this.handleMetadataChanged(meta)
				);

				return void 0;
			});
		});
	}

	private handleMetadataChanged(meta: string): void {
		this.metadata = meta;

		this._onMetadataChanged.fire();
	}

	getMetadata(): string {
		return this.metadata;
	}

	clearInput(): void {

		// Clear Meta
		this.handleMetadataChanged(null);

		// Empty HTML Container
		$(this.binaryContainer).empty();

		super.clearInput();
	}

	layout(dimension: Dimension): void {

		// Pass on to Binary Container
		this.binaryContainer.size(dimension.width, dimension.height);
		this.scrollbar.scanDomNode();
		if (this.resourceViewerContext) {
			this.resourceViewerContext.layout(dimension);
		}
	}

	focus(): void {
		this.binaryContainer.domFocus();
	}

	dispose(): void {

		// Destroy Container
		this.binaryContainer.destroy();

		super.dispose();
	}
}
