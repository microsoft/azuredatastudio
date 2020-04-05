/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import 'vs/css!./welcomeTour';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';

import { ICommandService } from 'vs/platform/commands/common/commands';
import { Disposable } from 'vs/base/common/lifecycle';
import { RawContextKey, IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
// import { KeyCode } from 'vs/base/common/keyCodes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { textPreformatForeground, foreground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyCode } from 'vs/base/common/keyCodes';

const $ = dom.$;

interface TourCopy {
	key: string;
	header: string;
	body: string;
	step: string;
	elmClass: string;
	id: string;
	btnId: string;
	btnText: string;
	docs: string;
	elementToAppendTo: string;
	subjectImage?: string;
}

const tourCopy: TourCopy[] = [
	{ key: 'search', header: 'Search', body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', step: '1', elmClass: 'overview_tour_search', id: 'overview_tour_search', btnId: 'overview_tour_search_btn', btnText: 'Next', docs: '', elementToAppendTo: '.action-label.codicon-search' },
	{ key: 'explorer', header: 'Explorer', body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', step: '2', elmClass: 'overview_tour_explorer', id: 'overview_tour_explorer', btnId: 'overview_tour_explorer_btn', btnText: 'Next', docs: '', elementToAppendTo: '.action-label.codicon-files' },
	{ key: 'source_control', header: 'Source Control', body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', step: '3', elmClass: 'overview_tour_sourceControl', id: 'overview_tour_sourceControl', btnId: 'overview_tour_sourceControl_btn', btnText: 'Next', docs: 'https://docs.microsoft.com/en-us/sql/azure-data-studio/source-control?view=sql-server-ver15', elementToAppendTo: '.action-label.codicon-source-control' },
	{ key: 'extensions', header: 'Extensions', body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', step: '4', elmClass: 'overview_tour_extensions', id: 'overview_tour_extensions', btnId: 'overview_tour_extensions_btn', btnText: 'Next', docs: 'https://docs.microsoft.com/en-us/sql/azure-data-studio/extensions?view=sql-server-ver15', elementToAppendTo: '.action-label.codicon-extensions' },
	{ key: 'connections', header: 'Connections', body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', step: '5', elmClass: 'overview_tour_connections', id: 'overview_tour_connections', btnId: 'overview_tour_connections_btn', btnText: 'Next', docs: 'https://docs.microsoft.com/en-us/sql/azure-data-studio/quickstart-sql-server?view=sql-server-ver15', elementToAppendTo: '.action-label.dataExplorer' },
	{ key: 'jupyer_books', header: 'Jupyter Books', body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', step: '6', elmClass: 'overview_tour_jupyterBooks', id: 'overview_tour_jupyterBooks', btnId: 'overview_tour_jupyter_btn', btnText: 'Next', docs: 'https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-notebooks?view=sql-server-ver15', elementToAppendTo: '.action-label.activity-workbench-view-extension-books-explorer' },
	{ key: 'command_palette', header: 'Command Palette', body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.', step: '7', elmClass: 'overview_tour_commandPalette', id: 'overview_tour_commandPalette', btnId: 'overview_tour_commandPalette_btn', btnText: 'Finish', docs: 'https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-notebooks?view=sql-server-ver15', elementToAppendTo: '.action-label.activity-workbench-view-extension-books-explorer', subjectImage: './../../media/commandPalette.png' },
];

const OVERLAY_VISIBLE = new RawContextKey<boolean>('interfaceOverviewVisible', false);

let welcomeOverlay: WelcomeTour;

class WelcomeTourAction extends Action {

	public static readonly ID = 'workbench.action.showWelcomeTour';
	public static readonly LABEL = localize('welcomeTour', "User Welcome Tour");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (!welcomeOverlay) {
			welcomeOverlay = this.instantiationService.createInstance(WelcomeTour);
		}
		welcomeOverlay.show();
		return Promise.resolve();
	}
}

export class HideWelcomeTourAction extends Action {

	public static readonly ID = 'workbench.action.hideWelcomeTour';
	public static readonly LABEL = localize('hideWelcomeTour', "Hide Welcome Tour");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (welcomeOverlay) {
			welcomeOverlay.hide();
		}
		return Promise.resolve();
	}
}

export class WelcomeTour extends Disposable {

	private _overlayVisible: IContextKey<boolean>;
	private _overlay!: HTMLElement;

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
	) {
		super();
		this._overlayVisible = OVERLAY_VISIBLE.bindTo(this._contextKeyService);
		this.create();
	}

	private create(): void {
		const offset = this.layoutService.offset?.top ?? 0;
		const tourElements = [];
		this._overlay = dom.append(this.layoutService.container, $('.ads_tour'));
		this._overlay.style.top = `${offset}px`;
		this._overlay.style.height = `calc(100% - ${offset}px)`;
		this._overlay.style.display = 'none';
		this._overlay.tabIndex = -1;

		// this._register(dom.addStandardDisposableListener(this._overlay, 'click', () => this.hide()));
		this.commandService.onWillExecuteCommand(() => this.hide());


		// const editorOpen = !!this.editorService.visibleEditors.length;
		// tourCopy.filter(key => !('withEditor' in key) || key.withEditor === editorOpen)

		tourCopy.forEach(({ key, header, body, step, elmClass, id, btnId, btnText, docs, elementToAppendTo }, i) => {
			const container = document.createElement('div');
			const subjectElement = document.querySelector(elementToAppendTo) as HTMLElement;
			const subjectElementPosition = subjectElement.getBoundingClientRect();
			let positionHorizontal = Math.round((subjectElementPosition.left + 45)) + 'px';
			if (key === 'command_palette') {
				this.createCommandPaletteImg();
			} else {
				positionHorizontal = Math.round((subjectElementPosition.left + 45)) + 'px';
				container.classList.add('arrow_left');
				container.style.top = '112px';
			}
			const flexClasses = ['flex', 'column'];
			const btnContainer = document.createElement('div');
			const flexContainer = document.createElement('div');
			const headerTag = document.createElement('h1');
			const bodyTag = document.createElement('p');
			const stepText = document.createElement('p');
			const btn = document.createElement('a');
			const docsLink = document.createElement('a');
			flexContainer.classList.add(...flexClasses);
			subjectElement.style.pointerEvents = 'none';
			container.classList.add('popup');
			btnContainer.classList.add('tour_btn_container');
			docsLink.classList.add('docs_link');
			container.classList.add(elmClass);
			container.classList.add('tour_element');
			container.id = id;
			btn.style.color = 'red';
			if (i !== 0) {
				container.classList.add('hide');
			} else {
				container.classList.add('show');
			}
			const buttonClasses = ['btn', 'btn_primary', 'overview_tour_btn_next'];
			btn.classList.add(...buttonClasses);
			btn.id = btnId;
			headerTag.innerText = header;
			bodyTag.innerText = body;
			btn.innerText = btnText;
			docsLink.innerText = 'Read more';
			docsLink.href = docs;
			stepText.innerText = `${step} of 7`;
			btnContainer.appendChild(docsLink);
			btnContainer.appendChild(stepText);
			btnContainer.appendChild(btn);
			flexContainer.appendChild(headerTag);
			flexContainer.appendChild(bodyTag);
			flexContainer.appendChild(btnContainer);
			container.style.position = 'absolute';
			container.appendChild(flexContainer);
			if (key !== 'command_palette') {
				container.classList.add('arrow_left');
				container.style.left = positionHorizontal;
				container.style.top = '112px';
			} else {
				container.classList.add('arrow_top');
				container.style.left = '0';
				container.style.right = '0';
				container.style.margin = 'auto';
				container.style.top = '369px';
			}
			this._overlay.append(container, $(`.${elmClass}`));
			tourElements.push(container);
		});
		this.buildInteractions();
	}

	private buildInteractions() {
		const popups = document.querySelectorAll('.popup') as NodeListOf<Element>;
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		const context = this;
		menuBarItems.forEach((elm) => {
			elm.style.pointerEvents = 'none';
		});
		popups.forEach(function (elm, i) {
			const btn = elm.querySelector('.overview_tour_btn_next');
			const popupsLength = popups.length;
			btn.addEventListener('click', function () {
				if (i === (popupsLength - 2)) {
					const commandPaletteImg = document.querySelector('.command_palette_placeholder');
					commandPaletteImg.classList.remove('hide');
					commandPaletteImg.classList.add('show');
				}
				if (i === (popupsLength - 1)) {
					context.hide();
					return;
				}
				let next = i + 1;
				popups[next].classList.add('show');
				popups[i].classList.remove('show');
			});
		});
		this.show();
	}

	public show() {
		if (this._overlay.style.display !== 'block') {
			const firstTourElement = document.querySelector('.tour_element');
			firstTourElement.classList.add('show');
			this._overlay.style.display = 'block';
			const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
			dom.addClass(workbench, 'blur-background');
			this._overlayVisible.set(true);
			this._overlay.focus();
		}
	}

	public hide() {
		const commandPaletteSpoof = document.querySelector('.command_palette_placeholder');
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		menuBarItems.forEach(function (elm) {
			elm.style.pointerEvents = 'auto';
		});
		tourCopy.forEach(function ({ id }) {
			document.querySelector(`#${id}`).remove();
		});
		if (this._overlay.style.display !== 'none') {
			this._overlay.style.display = 'none';
			const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
			dom.removeClass(workbench, 'blur-background');
			this._overlayVisible.reset();
		}
		commandPaletteSpoof.remove();

	}

	private createCommandPaletteImg() {
		const commandPaletteImgSrc = require.toUrl('./../../welcome/welcomeTour/media/commandPalette.png');
		const commandPaletteImg: HTMLImageElement = document.createElement('img');
		commandPaletteImg.src = require.toUrl(commandPaletteImgSrc);
		commandPaletteImg.classList.add('command_palette_placeholder');
		commandPaletteImg.classList.add('hide');
		this._overlay.append(commandPaletteImg);
	}

}

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(WelcomeTourAction, WelcomeTourAction.ID, WelcomeTourAction.LABEL), 'Help: Welcome Tour', localize('help', "Help"));

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(HideWelcomeTourAction, HideWelcomeTourAction.ID, HideWelcomeTourAction.LABEL, { primary: KeyCode.Escape }, OVERLAY_VISIBLE), 'Help: Hide Welcome Tour', localize('help', "Help"));


// theming
registerThemingParticipant((theme, collector) => {
	const key = theme.getColor(foreground);
	if (key) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay > .key { color: ${key}; }`);
	}
	const backgroundColor = Color.fromHex(theme.type === 'light' ? '#FFFFFF85' : '#00000085');
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay { background: ${backgroundColor}; }`);
	}
	const shortcut = theme.getColor(textPreformatForeground);
	if (shortcut) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay > .key > .shortcut { color: ${shortcut}; }`);
	}
});
