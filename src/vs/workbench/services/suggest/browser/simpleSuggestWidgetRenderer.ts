/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, show } from 'vs/base/browser/dom';
import { IconLabel, IIconLabelValueOptions } from 'vs/base/browser/ui/iconLabel/iconLabel';
import { IListRenderer } from 'vs/base/browser/ui/list/list';
import { SimpleCompletionItem } from 'vs/workbench/services/suggest/browser/simpleCompletionItem';
import { Codicon } from 'vs/base/common/codicons';
import { Emitter, Event } from 'vs/base/common/event';
import { createMatches } from 'vs/base/common/filters';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ThemeIcon } from 'vs/base/common/themables';

export function getAriaId(index: number): string {
	return `simple-suggest-aria-id:${index}`;
}

export interface ISimpleSuggestionTemplateData {
	readonly root: HTMLElement;

	/**
	 * Flexbox
	 * < ------------- left ------------ >     < --- right -- >
	 * <icon><label><signature><qualifier>     <type><readmore>
	 */
	readonly left: HTMLElement;
	readonly right: HTMLElement;

	readonly icon: HTMLElement;
	readonly colorspan: HTMLElement;
	readonly iconLabel: IconLabel;
	readonly iconContainer: HTMLElement;
	readonly parametersLabel: HTMLElement;
	readonly qualifierLabel: HTMLElement;
	/**
	 * Showing either `CompletionItem#details` or `CompletionItemLabel#type`
	 */
	readonly detailsLabel: HTMLElement;
	// readonly readMore: HTMLElement;
	readonly disposables: DisposableStore;
}

export class SimpleSuggestWidgetItemRenderer implements IListRenderer<SimpleCompletionItem, ISimpleSuggestionTemplateData> {

	private readonly _onDidToggleDetails = new Emitter<void>();
	readonly onDidToggleDetails: Event<void> = this._onDidToggleDetails.event;

	readonly templateId = 'suggestion';

	dispose(): void {
		this._onDidToggleDetails.dispose();
	}

	renderTemplate(container: HTMLElement): ISimpleSuggestionTemplateData {
		const disposables = new DisposableStore();

		const root = container;
		root.classList.add('show-file-icons');

		const icon = append(container, $('.icon'));
		const colorspan = append(icon, $('span.colorspan'));

		const text = append(container, $('.contents'));
		const main = append(text, $('.main'));

		const iconContainer = append(main, $('.icon-label.codicon'));
		const left = append(main, $('span.left'));
		const right = append(main, $('span.right'));

		const iconLabel = new IconLabel(left, { supportHighlights: true, supportIcons: true });
		disposables.add(iconLabel);

		const parametersLabel = append(left, $('span.signature-label'));
		const qualifierLabel = append(left, $('span.qualifier-label'));
		const detailsLabel = append(right, $('span.details-label'));

		// const readMore = append(right, $('span.readMore' + ThemeIcon.asCSSSelector(suggestMoreInfoIcon)));
		// readMore.title = nls.localize('readMore', "Read More");

		const configureFont = () => {
			// TODO: Implement
			// const options = this._editor.getOptions();
			// const fontInfo = options.get(EditorOption.fontInfo);
			const fontFamily = 'Hack'; //fontInfo.getMassagedFontFamily();
			const fontFeatureSettings = ''; //fontInfo.fontFeatureSettings;
			const fontSize = '12'; // = options.get(EditorOption.suggestFontSize) || fontInfo.fontSize;
			const lineHeight = '20'; // options.get(EditorOption.suggestLineHeight) || fontInfo.lineHeight;
			const fontWeight = 'normal'; //fontInfo.fontWeight;
			const letterSpacing = '0'; // fontInfo.letterSpacing;
			const fontSizePx = `${fontSize}px`;
			const lineHeightPx = `${lineHeight}px`;
			const letterSpacingPx = `${letterSpacing}px`;

			root.style.fontSize = fontSizePx;
			root.style.fontWeight = fontWeight;
			root.style.letterSpacing = letterSpacingPx;
			main.style.fontFamily = fontFamily;
			main.style.fontFeatureSettings = fontFeatureSettings;
			main.style.lineHeight = lineHeightPx;
			icon.style.height = lineHeightPx;
			icon.style.width = lineHeightPx;
			// readMore.style.height = lineHeightPx;
			// readMore.style.width = lineHeightPx;
		};

		configureFont();

		// data.disposables.add(this._editor.onDidChangeConfiguration(e => {
		// 	if (e.hasChanged(EditorOption.fontInfo) || e.hasChanged(EditorOption.suggestFontSize) || e.hasChanged(EditorOption.suggestLineHeight)) {
		// 		configureFont();
		// 	}
		// }));

		return { root, left, right, icon, colorspan, iconLabel, iconContainer, parametersLabel, qualifierLabel, detailsLabel, disposables };
	}

	renderElement(element: SimpleCompletionItem, index: number, data: ISimpleSuggestionTemplateData): void {
		const { completion } = element;
		data.root.id = getAriaId(index);
		data.colorspan.style.backgroundColor = '';

		const labelOptions: IIconLabelValueOptions = {
			labelEscapeNewLines: true,
			matches: createMatches(element.score)
		};

		// const color: string[] = [];
		// if (completion.kind === CompletionItemKind.Color && _completionItemColor.extract(element, color)) {
		// 	// special logic for 'color' completion items
		// 	data.icon.className = 'icon customcolor';
		// 	data.iconContainer.className = 'icon hide';
		// 	data.colorspan.style.backgroundColor = color[0];

		// } else if (completion.kind === CompletionItemKind.File && this._themeService.getFileIconTheme().hasFileIcons) {
		// 	// special logic for 'file' completion items
		// 	data.icon.className = 'icon hide';
		// 	data.iconContainer.className = 'icon hide';
		// 	const labelClasses = getIconClasses(this._modelService, this._languageService, URI.from({ scheme: 'fake', path: element.textLabel }), FileKind.FILE);
		// 	const detailClasses = getIconClasses(this._modelService, this._languageService, URI.from({ scheme: 'fake', path: completion.detail }), FileKind.FILE);
		// 	labelOptions.extraClasses = labelClasses.length > detailClasses.length ? labelClasses : detailClasses;

		// } else if (completion.kind === CompletionItemKind.Folder && this._themeService.getFileIconTheme().hasFolderIcons) {
		// 	// special logic for 'folder' completion items
		// 	data.icon.className = 'icon hide';
		// 	data.iconContainer.className = 'icon hide';
		// 	labelOptions.extraClasses = [
		// 		getIconClasses(this._modelService, this._languageService, URI.from({ scheme: 'fake', path: element.textLabel }), FileKind.FOLDER),
		// 		getIconClasses(this._modelService, this._languageService, URI.from({ scheme: 'fake', path: completion.detail }), FileKind.FOLDER)
		// 	].flat();
		// } else {
		// normal icon
		data.icon.className = 'icon hide';
		data.iconContainer.className = '';
		data.iconContainer.classList.add('suggest-icon', ...ThemeIcon.asClassNameArray(completion.icon || Codicon.symbolText));
		// }

		// if (completion.tags && completion.tags.indexOf(CompletionItemTag.Deprecated) >= 0) {
		// 	labelOptions.extraClasses = (labelOptions.extraClasses || []).concat(['deprecated']);
		// 	labelOptions.matches = [];
		// }

		data.iconLabel.setLabel(completion.label, undefined, labelOptions);
		// if (typeof completion.label === 'string') {
		data.parametersLabel.textContent = '';
		data.detailsLabel.textContent = stripNewLines(completion.detail || '');
		data.root.classList.add('string-label');
		// } else {
		// 	data.parametersLabel.textContent = stripNewLines(completion.label.detail || '');
		// 	data.detailsLabel.textContent = stripNewLines(completion.label.description || '');
		// 	data.root.classList.remove('string-label');
		// }

		// if (this._editor.getOption(EditorOption.suggest).showInlineDetails) {
		show(data.detailsLabel);
		// } else {
		// 	hide(data.detailsLabel);
		// }

		// if (canExpandCompletionItem(element)) {
		// 	data.right.classList.add('can-expand-details');
		// 	show(data.readMore);
		// 	data.readMore.onmousedown = e => {
		// 		e.stopPropagation();
		// 		e.preventDefault();
		// 	};
		// 	data.readMore.onclick = e => {
		// 		e.stopPropagation();
		// 		e.preventDefault();
		// 		this._onDidToggleDetails.fire();
		// 	};
		// } else {
		data.right.classList.remove('can-expand-details');
		// hide(data.readMore);
		// data.readMore.onmousedown = null;
		// data.readMore.onclick = null;
		// }
	}

	disposeTemplate(templateData: ISimpleSuggestionTemplateData): void {
		templateData.disposables.dispose();
	}
}

function stripNewLines(str: string): string {
	return str.replace(/\r\n|\r|\n/g, '');
}
