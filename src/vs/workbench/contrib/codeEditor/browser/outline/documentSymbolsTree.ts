/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./documentSymbolsTree';
import 'vs/editor/contrib/symbolIcons/browser/symbolIcons'; // The codicon symbol colors are defined here and must be loaded to get colors
import * as dom from 'vs/base/browser/dom';
import { HighlightedLabel } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { IIdentityProvider, IKeyboardNavigationLabelProvider, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { ITreeNode, ITreeRenderer, ITreeFilter } from 'vs/base/browser/ui/tree/tree';
import { createMatches, FuzzyScore } from 'vs/base/common/filters';
import { Range } from 'vs/editor/common/core/range';
import { SymbolKind, SymbolKinds, SymbolTag, getAriaLabelForSymbol, symbolKindNames } from 'vs/editor/common/languages';
import { OutlineElement, OutlineGroup, OutlineModel } from 'vs/editor/contrib/documentSymbols/browser/outlineModel';
import { localize } from 'vs/nls';
import { IconLabel, IIconLabelValueOptions } from 'vs/base/browser/ui/iconLabel/iconLabel';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { MarkerSeverity } from 'vs/platform/markers/common/markers';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { listErrorForeground, listWarningForeground } from 'vs/platform/theme/common/colorRegistry';
import { IdleValue } from 'vs/base/common/async';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfiguration';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IOutlineComparator, OutlineConfigKeys } from 'vs/workbench/services/outline/browser/outline';
import { ThemeIcon } from 'vs/base/common/themables';

export type DocumentSymbolItem = OutlineGroup | OutlineElement;

export class DocumentSymbolNavigationLabelProvider implements IKeyboardNavigationLabelProvider<DocumentSymbolItem> {

	getKeyboardNavigationLabel(element: DocumentSymbolItem): { toString(): string } {
		if (element instanceof OutlineGroup) {
			return element.label;
		} else {
			return element.symbol.name;
		}
	}
}

export class DocumentSymbolAccessibilityProvider implements IListAccessibilityProvider<DocumentSymbolItem> {

	constructor(private readonly _ariaLabel: string) { }

	getWidgetAriaLabel(): string {
		return this._ariaLabel;
	}
	getAriaLabel(element: DocumentSymbolItem): string | null {
		if (element instanceof OutlineGroup) {
			return element.label;
		} else {
			return getAriaLabelForSymbol(element.symbol.name, element.symbol.kind);
		}
	}
}

export class DocumentSymbolIdentityProvider implements IIdentityProvider<DocumentSymbolItem> {
	getId(element: DocumentSymbolItem): { toString(): string } {
		return element.id;
	}
}

class DocumentSymbolGroupTemplate {
	static readonly id = 'DocumentSymbolGroupTemplate';
	constructor(
		readonly labelContainer: HTMLElement,
		readonly label: HighlightedLabel,
	) { }
}

class DocumentSymbolTemplate {
	static readonly id = 'DocumentSymbolTemplate';
	constructor(
		readonly container: HTMLElement,
		readonly iconLabel: IconLabel,
		readonly iconClass: HTMLElement,
		readonly decoration: HTMLElement,
	) { }
}

export class DocumentSymbolVirtualDelegate implements IListVirtualDelegate<DocumentSymbolItem> {

	getHeight(_element: DocumentSymbolItem): number {
		return 22;
	}

	getTemplateId(element: DocumentSymbolItem): string {
		return element instanceof OutlineGroup
			? DocumentSymbolGroupTemplate.id
			: DocumentSymbolTemplate.id;
	}
}

export class DocumentSymbolGroupRenderer implements ITreeRenderer<OutlineGroup, FuzzyScore, DocumentSymbolGroupTemplate> {

	readonly templateId: string = DocumentSymbolGroupTemplate.id;

	renderTemplate(container: HTMLElement): DocumentSymbolGroupTemplate {
		const labelContainer = dom.$('.outline-element-label');
		container.classList.add('outline-element');
		dom.append(container, labelContainer);
		return new DocumentSymbolGroupTemplate(labelContainer, new HighlightedLabel(labelContainer));
	}

	renderElement(node: ITreeNode<OutlineGroup, FuzzyScore>, _index: number, template: DocumentSymbolGroupTemplate): void {
		template.label.set(node.element.label, createMatches(node.filterData));
	}

	disposeTemplate(_template: DocumentSymbolGroupTemplate): void {
		// nothing
	}
}

export class DocumentSymbolRenderer implements ITreeRenderer<OutlineElement, FuzzyScore, DocumentSymbolTemplate> {

	readonly templateId: string = DocumentSymbolTemplate.id;

	constructor(
		private _renderMarker: boolean,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IThemeService private readonly _themeService: IThemeService,
	) { }

	renderTemplate(container: HTMLElement): DocumentSymbolTemplate {
		container.classList.add('outline-element');
		const iconLabel = new IconLabel(container, { supportHighlights: true });
		const iconClass = dom.$('.outline-element-icon');
		const decoration = dom.$('.outline-element-decoration');
		container.prepend(iconClass);
		container.appendChild(decoration);
		return new DocumentSymbolTemplate(container, iconLabel, iconClass, decoration);
	}

	renderElement(node: ITreeNode<OutlineElement, FuzzyScore>, _index: number, template: DocumentSymbolTemplate): void {
		const { element } = node;
		const extraClasses = ['nowrap'];
		const options: IIconLabelValueOptions = {
			matches: createMatches(node.filterData),
			labelEscapeNewLines: true,
			extraClasses,
			title: localize('title.template', "{0} ({1})", element.symbol.name, symbolKindNames[element.symbol.kind])
		};
		if (this._configurationService.getValue(OutlineConfigKeys.icons)) {
			// add styles for the icons
			template.iconClass.className = '';
			template.iconClass.classList.add('outline-element-icon', 'inline', ...ThemeIcon.asClassNameArray(SymbolKinds.toIcon(element.symbol.kind)));
		}
		if (element.symbol.tags.indexOf(SymbolTag.Deprecated) >= 0) {
			extraClasses.push(`deprecated`);
			options.matches = [];
		}
		template.iconLabel.setLabel(element.symbol.name, element.symbol.detail, options);

		if (this._renderMarker) {
			this._renderMarkerInfo(element, template);
		}
	}

	private _renderMarkerInfo(element: OutlineElement, template: DocumentSymbolTemplate): void {

		if (!element.marker) {
			dom.hide(template.decoration);
			template.container.style.removeProperty('--outline-element-color');
			return;
		}

		const { count, topSev } = element.marker;
		const color = this._themeService.getColorTheme().getColor(topSev === MarkerSeverity.Error ? listErrorForeground : listWarningForeground);
		const cssColor = color ? color.toString() : 'inherit';

		// color of the label
		if (this._configurationService.getValue(OutlineConfigKeys.problemsColors)) {
			template.container.style.setProperty('--outline-element-color', cssColor);
		} else {
			template.container.style.removeProperty('--outline-element-color');
		}

		// badge with color/rollup
		if (!this._configurationService.getValue(OutlineConfigKeys.problemsBadges)) {
			dom.hide(template.decoration);

		} else if (count > 0) {
			dom.show(template.decoration);
			template.decoration.classList.remove('bubble');
			template.decoration.innerText = count < 10 ? count.toString() : '+9';
			template.decoration.title = count === 1 ? localize('1.problem', "1 problem in this element") : localize('N.problem', "{0} problems in this element", count);
			template.decoration.style.setProperty('--outline-element-color', cssColor);

		} else {
			dom.show(template.decoration);
			template.decoration.classList.add('bubble');
			template.decoration.innerText = '\uea71';
			template.decoration.title = localize('deep.problem', "Contains elements with problems");
			template.decoration.style.setProperty('--outline-element-color', cssColor);
		}
	}



	disposeTemplate(_template: DocumentSymbolTemplate): void {
		_template.iconLabel.dispose();
	}
}

export class DocumentSymbolFilter implements ITreeFilter<DocumentSymbolItem> {

	static readonly kindToConfigName = Object.freeze({
		[SymbolKind.File]: 'showFiles',
		[SymbolKind.Module]: 'showModules',
		[SymbolKind.Namespace]: 'showNamespaces',
		[SymbolKind.Package]: 'showPackages',
		[SymbolKind.Class]: 'showClasses',
		[SymbolKind.Method]: 'showMethods',
		[SymbolKind.Property]: 'showProperties',
		[SymbolKind.Field]: 'showFields',
		[SymbolKind.Constructor]: 'showConstructors',
		[SymbolKind.Enum]: 'showEnums',
		[SymbolKind.Interface]: 'showInterfaces',
		[SymbolKind.Function]: 'showFunctions',
		[SymbolKind.Variable]: 'showVariables',
		[SymbolKind.Constant]: 'showConstants',
		[SymbolKind.String]: 'showStrings',
		[SymbolKind.Number]: 'showNumbers',
		[SymbolKind.Boolean]: 'showBooleans',
		[SymbolKind.Array]: 'showArrays',
		[SymbolKind.Object]: 'showObjects',
		[SymbolKind.Key]: 'showKeys',
		[SymbolKind.Null]: 'showNull',
		[SymbolKind.EnumMember]: 'showEnumMembers',
		[SymbolKind.Struct]: 'showStructs',
		[SymbolKind.Event]: 'showEvents',
		[SymbolKind.Operator]: 'showOperators',
		[SymbolKind.TypeParameter]: 'showTypeParameters',
	});

	constructor(
		private readonly _prefix: 'breadcrumbs' | 'outline',
		@ITextResourceConfigurationService private readonly _textResourceConfigService: ITextResourceConfigurationService,
	) { }

	filter(element: DocumentSymbolItem): boolean {
		const outline = OutlineModel.get(element);
		if (!(element instanceof OutlineElement)) {
			return true;
		}
		const configName = DocumentSymbolFilter.kindToConfigName[element.symbol.kind];
		const configKey = `${this._prefix}.${configName}`;
		return this._textResourceConfigService.getValue(outline?.uri, configKey);
	}
}

export class DocumentSymbolComparator implements IOutlineComparator<DocumentSymbolItem> {

	private readonly _collator = new IdleValue<Intl.Collator>(() => new Intl.Collator(undefined, { numeric: true }));

	compareByPosition(a: DocumentSymbolItem, b: DocumentSymbolItem): number {
		if (a instanceof OutlineGroup && b instanceof OutlineGroup) {
			return a.order - b.order;
		} else if (a instanceof OutlineElement && b instanceof OutlineElement) {
			return Range.compareRangesUsingStarts(a.symbol.range, b.symbol.range) || this._collator.value.compare(a.symbol.name, b.symbol.name);
		}
		return 0;
	}
	compareByType(a: DocumentSymbolItem, b: DocumentSymbolItem): number {
		if (a instanceof OutlineGroup && b instanceof OutlineGroup) {
			return a.order - b.order;
		} else if (a instanceof OutlineElement && b instanceof OutlineElement) {
			return a.symbol.kind - b.symbol.kind || this._collator.value.compare(a.symbol.name, b.symbol.name);
		}
		return 0;
	}
	compareByName(a: DocumentSymbolItem, b: DocumentSymbolItem): number {
		if (a instanceof OutlineGroup && b instanceof OutlineGroup) {
			return a.order - b.order;
		} else if (a instanceof OutlineElement && b instanceof OutlineElement) {
			return this._collator.value.compare(a.symbol.name, b.symbol.name) || Range.compareRangesUsingStarts(a.symbol.range, b.symbol.range);
		}
		return 0;
	}
}
