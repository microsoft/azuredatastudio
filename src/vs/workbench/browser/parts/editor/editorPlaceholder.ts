/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/editorplaceholder';
import { localize } from 'vs/nls';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Dimension, size, clearNode, append } from 'vs/base/browser/dom';
import { CancellationToken } from 'vs/base/common/cancellation';
import { DisposableStore, IDisposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { assertIsDefined, assertAllDefined } from 'vs/base/common/types';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { isSingleFolderWorkspaceIdentifier, toWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { EditorPaneDescriptor } from 'vs/workbench/browser/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Link } from 'vs/platform/opener/browser/link';

abstract class EditorPanePlaceholder extends EditorPane {

	private container: HTMLElement | undefined;
	private scrollbar: DomScrollableElement | undefined;
	private inputDisposable = this._register(new MutableDisposable());

	constructor(
		id: string,
		private readonly title: string,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService
	) {
		super(id, telemetryService, themeService, storageService);
	}

	override getTitle(): string {
		return this.title;
	}

	protected createEditor(parent: HTMLElement): void {

		// Container
		this.container = document.createElement('div');
		this.container.className = 'monaco-editor-pane-placeholder';
		this.container.style.outline = 'none';
		this.container.tabIndex = 0; // enable focus support from the editor part (do not remove)

		// Custom Scrollbars
		this.scrollbar = this._register(new DomScrollableElement(this.container, { horizontal: ScrollbarVisibility.Auto, vertical: ScrollbarVisibility.Auto }));
		parent.appendChild(this.scrollbar.getDomNode());
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		// Check for cancellation
		if (token.isCancellationRequested) {
			return;
		}

		// Render Input
		this.inputDisposable.value = this.renderInput();
	}

	private renderInput(): IDisposable {
		const [container, scrollbar] = assertAllDefined(this.container, this.scrollbar);

		// Reset any previous contents
		clearNode(container);

		// Delegate to implementation
		const disposables = new DisposableStore();
		this.renderBody(container, disposables);

		// Adjust scrollbar
		scrollbar.scanDomNode();

		return disposables;
	}

	protected abstract renderBody(container: HTMLElement, disposables: DisposableStore): void;

	override clearInput(): void {
		if (this.container) {
			clearNode(this.container);
		}

		this.inputDisposable.clear();

		super.clearInput();
	}

	layout(dimension: Dimension): void {
		const [container, scrollbar] = assertAllDefined(this.container, this.scrollbar);

		// Pass on to Container
		size(container, dimension.width, dimension.height);

		// Adjust scrollbar
		scrollbar.scanDomNode();
	}

	override focus(): void {
		const container = assertIsDefined(this.container);

		container.focus();
	}

	override dispose(): void {
		this.container?.remove();

		super.dispose();
	}
}

export class WorkspaceTrustRequiredEditor extends EditorPanePlaceholder {

	static readonly ID = 'workbench.editors.workspaceTrustRequiredEditor';
	static readonly LABEL = localize('trustRequiredEditor', "Workspace Trust Required");
	static readonly DESCRIPTOR = EditorPaneDescriptor.create(WorkspaceTrustRequiredEditor, WorkspaceTrustRequiredEditor.ID, WorkspaceTrustRequiredEditor.LABEL);

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(WorkspaceTrustRequiredEditor.ID, WorkspaceTrustRequiredEditor.LABEL, telemetryService, themeService, storageService);
	}

	protected renderBody(container: HTMLElement, disposables: DisposableStore): void {
		const label = container.appendChild(document.createElement('p'));
		label.textContent = isSingleFolderWorkspaceIdentifier(toWorkspaceIdentifier(this.workspaceService.getWorkspace())) ?
			localize('requiresFolderTrustText', "The file is not displayed in the editor because trust has not been granted to the folder.") :
			localize('requiresWorkspaceTrustText', "The file is not displayed in the editor because trust has not been granted to the workspace.");

		const link = this._register(this.instantiationService.createInstance(Link, {
			label: localize('manageTrust', "Manage Workspace Trust"),
			href: ''
		}, {
			opener: () => this.commandService.executeCommand('workbench.trust.manage')
		}));

		append(label, link.el);
	}
}

export class UnavailableEditor extends EditorPanePlaceholder {

	static readonly ID = 'workbench.editors.unavailableEditor';
	static readonly LABEL = localize('unavailableEditor', "Unavailable Editor");
	static readonly DESCRIPTOR = EditorPaneDescriptor.create(UnavailableEditor, UnavailableEditor.ID, UnavailableEditor.LABEL);

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(UnavailableEditor.ID, UnavailableEditor.LABEL, telemetryService, themeService, storageService);
	}

	protected renderBody(container: HTMLElement, disposables: DisposableStore): void {
		const label = container.appendChild(document.createElement('p'));
		label.textContent = localize('unavailableEditorText', "The editor could not be opened due to an error or an unavailable resource.");

		// Offer to re-open
		const group = this.group;
		const input = this.input;
		if (group && input) {
			const link = this._register(this.instantiationService.createInstance(Link, {
				label: localize('retry', "Try Again"),
				href: ''
			}, {
				opener: () => group.openEditor(input, this.options)
			}));

			append(label, link.el);
		}
	}
}
