/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from 'vs/base/common/arrays';
import { Emitter } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IExtensionIgnoredRecommendationsService, IgnoredRecommendationChangeNotification } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { IWorkspaceExtensionsConfigService } from 'vs/workbench/services/extensionRecommendations/common/workspaceExtensionsConfig';

const ignoredRecommendationsStorageKey = 'extensionsAssistant/ignored_recommendations';

export class ExtensionIgnoredRecommendationsService extends Disposable implements IExtensionIgnoredRecommendationsService {

	declare readonly _serviceBrand: undefined;

	private _onDidChangeIgnoredRecommendations = this._register(new Emitter<void>());
	readonly onDidChangeIgnoredRecommendations = this._onDidChangeIgnoredRecommendations.event;

	// Global Ignored Recommendations
	private _globalIgnoredRecommendations: string[] = [];
	get globalIgnoredRecommendations(): string[] { return [...this._globalIgnoredRecommendations]; }
	private _onDidChangeGlobalIgnoredRecommendation = this._register(new Emitter<IgnoredRecommendationChangeNotification>());
	readonly onDidChangeGlobalIgnoredRecommendation = this._onDidChangeGlobalIgnoredRecommendation.event;

	// Ignored Workspace Recommendations
	private ignoredWorkspaceRecommendations: string[] = [];

	get ignoredRecommendations(): string[] { return distinct([...this.globalIgnoredRecommendations, ...this.ignoredWorkspaceRecommendations]); }

	constructor(
		@IWorkspaceExtensionsConfigService private readonly workspaceExtensionsConfigService: IWorkspaceExtensionsConfigService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		this._globalIgnoredRecommendations = this.getCachedIgnoredRecommendations();
		this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, ignoredRecommendationsStorageKey, this._register(new DisposableStore()))(e => this.onDidStorageChange()));

		this.initIgnoredWorkspaceRecommendations();
	}

	private async initIgnoredWorkspaceRecommendations(): Promise<void> {
		this.ignoredWorkspaceRecommendations = await this.workspaceExtensionsConfigService.getUnwantedRecommendations();
		this._onDidChangeIgnoredRecommendations.fire();
		this._register(this.workspaceExtensionsConfigService.onDidChangeExtensionsConfigs(async () => {
			this.ignoredWorkspaceRecommendations = await this.workspaceExtensionsConfigService.getUnwantedRecommendations();
			this._onDidChangeIgnoredRecommendations.fire();
		}));
	}

	toggleGlobalIgnoredRecommendation(extensionId: string, shouldIgnore: boolean): void {
		extensionId = extensionId.toLowerCase();
		const ignored = this._globalIgnoredRecommendations.indexOf(extensionId) !== -1;
		if (ignored === shouldIgnore) {
			return;
		}

		this._globalIgnoredRecommendations = shouldIgnore ? [...this._globalIgnoredRecommendations, extensionId] : this._globalIgnoredRecommendations.filter(id => id !== extensionId);
		this.storeCachedIgnoredRecommendations(this._globalIgnoredRecommendations);
		this._onDidChangeGlobalIgnoredRecommendation.fire({ extensionId, isRecommended: !shouldIgnore });
		this._onDidChangeIgnoredRecommendations.fire();
	}

	private getCachedIgnoredRecommendations(): string[] {
		const ignoredRecommendations: string[] = JSON.parse(this.ignoredRecommendationsValue);
		return ignoredRecommendations.map(e => e.toLowerCase());
	}

	private onDidStorageChange(): void {
		if (this.ignoredRecommendationsValue !== this.getStoredIgnoredRecommendationsValue() /* This checks if current window changed the value or not */) {
			this._ignoredRecommendationsValue = undefined;
			this._globalIgnoredRecommendations = this.getCachedIgnoredRecommendations();
			this._onDidChangeIgnoredRecommendations.fire();
		}
	}

	private storeCachedIgnoredRecommendations(ignoredRecommendations: string[]): void {
		this.ignoredRecommendationsValue = JSON.stringify(ignoredRecommendations);
	}

	private _ignoredRecommendationsValue: string | undefined;
	private get ignoredRecommendationsValue(): string {
		if (!this._ignoredRecommendationsValue) {
			this._ignoredRecommendationsValue = this.getStoredIgnoredRecommendationsValue();
		}

		return this._ignoredRecommendationsValue;
	}

	private set ignoredRecommendationsValue(ignoredRecommendationsValue: string) {
		if (this.ignoredRecommendationsValue !== ignoredRecommendationsValue) {
			this._ignoredRecommendationsValue = ignoredRecommendationsValue;
			this.setStoredIgnoredRecommendationsValue(ignoredRecommendationsValue);
		}
	}

	private getStoredIgnoredRecommendationsValue(): string {
		return this.storageService.get(ignoredRecommendationsStorageKey, StorageScope.PROFILE, '[]');
	}

	private setStoredIgnoredRecommendationsValue(value: string): void {
		this.storageService.store(ignoredRecommendationsStorageKey, value, StorageScope.PROFILE, StorageTarget.USER);
	}

}

registerSingleton(IExtensionIgnoredRecommendationsService, ExtensionIgnoredRecommendationsService, InstantiationType.Delayed);
