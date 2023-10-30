/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IViewsRegistry, Extensions as ViewExtensions } from 'vs/workbench/common/views';
import { OutlinePane } from './outlinePane';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { VIEW_CONTAINER } from 'vs/workbench/contrib/files/browser/explorerViewlet';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Codicon } from 'vs/base/common/codicons';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { OutlineConfigKeys } from 'vs/workbench/services/outline/browser/outline';
import { IOutlinePane } from 'vs/workbench/contrib/outline/browser/outline';

// --- actions

import './outlineActions';

// --- view

const outlineViewIcon = registerIcon('outline-view-icon', Codicon.symbolClass, localize('outlineViewIcon', 'View icon of the outline view.'));

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: IOutlinePane.Id,
	name: localize('name', "Outline"),
	containerIcon: outlineViewIcon,
	ctorDescriptor: new SyncDescriptor(OutlinePane),
	canToggleVisibility: true,
	canMoveView: true,
	hideByDefault: false,
	collapsed: true,
	order: 2,
	weight: 30,
	focusCommand: { id: 'outline.focus' }
}], VIEW_CONTAINER);

// --- configurations

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	'id': 'outline',
	'order': 117,
	'title': localize('outlineConfigurationTitle', "Outline"),
	'type': 'object',
	'properties': {
		[OutlineConfigKeys.icons]: {
			'description': localize('outline.showIcons', "Render Outline elements with icons."),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.collapseItems]: {
			'description': localize('outline.initialState', "Controls whether Outline items are collapsed or expanded."),
			'type': 'string',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			'enum': [
				'alwaysCollapse',
				'alwaysExpand'
			],
			'enumDescriptions': [
				localize('outline.initialState.collapsed', "Collapse all items."),
				localize('outline.initialState.expanded', "Expand all items.")
			],
			'default': 'alwaysExpand'
		},
		[OutlineConfigKeys.problemsEnabled]: {
			'description': localize('outline.showProblem', "Show errors and warnings on Outline elements."),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.problemsColors]: {
			'description': localize('outline.problem.colors', "Use colors for errors and warnings on Outline elements."),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.problemsBadges]: {
			'description': localize('outline.problems.badges', "Use badges for errors and warnings on Outline elements."),
			'type': 'boolean',
			'default': true
		},
		'outline.showFiles': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.file', "When enabled, Outline shows `file`-symbols.")
		},
		'outline.showModules': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.module', "When enabled, Outline shows `module`-symbols.")
		},
		'outline.showNamespaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.namespace', "When enabled, Outline shows `namespace`-symbols.")
		},
		'outline.showPackages': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.package', "When enabled, Outline shows `package`-symbols.")
		},
		'outline.showClasses': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.class', "When enabled, Outline shows `class`-symbols.")
		},
		'outline.showMethods': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.method', "When enabled, Outline shows `method`-symbols.")
		},
		'outline.showProperties': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.property', "When enabled, Outline shows `property`-symbols.")
		},
		'outline.showFields': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.field', "When enabled, Outline shows `field`-symbols.")
		},
		'outline.showConstructors': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constructor', "When enabled, Outline shows `constructor`-symbols.")
		},
		'outline.showEnums': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enum', "When enabled, Outline shows `enum`-symbols.")
		},
		'outline.showInterfaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.interface', "When enabled, Outline shows `interface`-symbols.")
		},
		'outline.showFunctions': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.function', "When enabled, Outline shows `function`-symbols.")
		},
		'outline.showVariables': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.variable', "When enabled, Outline shows `variable`-symbols.")
		},
		'outline.showConstants': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constant', "When enabled, Outline shows `constant`-symbols.")
		},
		'outline.showStrings': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.string', "When enabled, Outline shows `string`-symbols.")
		},
		'outline.showNumbers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.number', "When enabled, Outline shows `number`-symbols.")
		},
		'outline.showBooleans': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.boolean', "When enabled, Outline shows `boolean`-symbols.")
		},
		'outline.showArrays': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.array', "When enabled, Outline shows `array`-symbols.")
		},
		'outline.showObjects': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.object', "When enabled, Outline shows `object`-symbols.")
		},
		'outline.showKeys': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.key', "When enabled, Outline shows `key`-symbols.")
		},
		'outline.showNull': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.null', "When enabled, Outline shows `null`-symbols.")
		},
		'outline.showEnumMembers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enumMember', "When enabled, Outline shows `enumMember`-symbols.")
		},
		'outline.showStructs': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.struct', "When enabled, Outline shows `struct`-symbols.")
		},
		'outline.showEvents': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.event', "When enabled, Outline shows `event`-symbols.")
		},
		'outline.showOperators': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.operator', "When enabled, Outline shows `operator`-symbols.")
		},
		'outline.showTypeParameters': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.typeParameter', "When enabled, Outline shows `typeParameter`-symbols.")
		}
	}
});
