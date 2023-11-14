/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable, isDisposable } from 'vs/base/common/lifecycle';
import { IStorage, IStorageDatabase, Storage } from 'vs/base/parts/storage/common/storage';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { AbstractStorageService, IStorageService, IStorageValueChangeEvent, StorageScope, StorageTarget, isProfileUsingDefaultStorage } from 'vs/platform/storage/common/storage';
import { Emitter, Event } from 'vs/base/common/event';
import { IRemoteService } from 'vs/platform/ipc/common/services';
import { ILogService } from 'vs/platform/log/common/log';
import { ApplicationStorageDatabaseClient, ProfileStorageDatabaseClient } from 'vs/platform/storage/common/storageIpc';
import { IUserDataProfile, IUserDataProfilesService, reviveProfile } from 'vs/platform/userDataProfile/common/userDataProfile';

export interface IProfileStorageValueChanges {
	readonly profile: IUserDataProfile;
	readonly changes: IStorageValueChangeEvent[];
}

export interface IProfileStorageChanges {
	readonly targetChanges: IUserDataProfile[];
	readonly valueChanges: IProfileStorageValueChanges[];
}

export interface IStorageValue {
	readonly value: string | undefined;
	readonly target: StorageTarget;
}

export const IUserDataProfileStorageService = createDecorator<IUserDataProfileStorageService>('IUserDataProfileStorageService');
export interface IUserDataProfileStorageService {
	readonly _serviceBrand: undefined;

	/**
	 * Emitted whenever data is updated or deleted in a profile storage or target of a profile storage entry changes
	 */
	readonly onDidChange: Event<IProfileStorageChanges>;

	/**
	 * Return the requested profile storage data
	 * @param profile The profile from which the data has to be read from
	 */
	readStorageData(profile: IUserDataProfile): Promise<Map<string, IStorageValue>>;

	/**
	 * Update the given profile storage data in the profile storage
	 * @param profile The profile to which the data has to be written to
	 * @param data Data that has to be updated
	 * @param target Storage target of the data
	 */
	updateStorageData(profile: IUserDataProfile, data: Map<string, string | undefined | null>, target: StorageTarget): Promise<void>;

	/**
	 * Calls a function with a storage service scoped to given profile.
	 */
	withProfileScopedStorageService<T>(profile: IUserDataProfile, fn: (storageService: IStorageService) => Promise<T>): Promise<T>;
}

export abstract class AbstractUserDataProfileStorageService extends Disposable implements IUserDataProfileStorageService {

	_serviceBrand: undefined;

	readonly abstract onDidChange: Event<IProfileStorageChanges>;

	constructor(
		@IStorageService protected readonly storageService: IStorageService
	) {
		super();
	}

	async readStorageData(profile: IUserDataProfile): Promise<Map<string, IStorageValue>> {
		return this.withProfileScopedStorageService(profile, async storageService => this.getItems(storageService));
	}

	async updateStorageData(profile: IUserDataProfile, data: Map<string, string | undefined | null>, target: StorageTarget): Promise<void> {
		return this.withProfileScopedStorageService(profile, async storageService => this.writeItems(storageService, data, target));
	}

	async withProfileScopedStorageService<T>(profile: IUserDataProfile, fn: (storageService: IStorageService) => Promise<T>): Promise<T> {
		if (this.storageService.hasScope(profile)) {
			return fn(this.storageService);
		}

		const storageDatabase = await this.createStorageDatabase(profile);
		const storageService = new StorageService(storageDatabase);
		try {
			await storageService.initialize();
			const result = await fn(storageService);
			await storageService.flush();
			return result;
		} finally {
			storageService.dispose();
			await this.closeAndDispose(storageDatabase);
		}
	}

	private getItems(storageService: IStorageService): Map<string, IStorageValue> {
		const result = new Map<string, IStorageValue>();
		const populate = (target: StorageTarget) => {
			for (const key of storageService.keys(StorageScope.PROFILE, target)) {
				result.set(key, { value: storageService.get(key, StorageScope.PROFILE), target });
			}
		};
		populate(StorageTarget.USER);
		populate(StorageTarget.MACHINE);
		return result;
	}

	private writeItems(storageService: IStorageService, items: Map<string, string | undefined | null>, target: StorageTarget): void {
		storageService.storeAll(Array.from(items.entries()).map(([key, value]) => ({ key, value, scope: StorageScope.PROFILE, target })), true);
	}

	protected async closeAndDispose(storageDatabase: IStorageDatabase): Promise<void> {
		try {
			await storageDatabase.close();
		} finally {
			if (isDisposable(storageDatabase)) {
				storageDatabase.dispose();
			}
		}
	}

	protected abstract createStorageDatabase(profile: IUserDataProfile): Promise<IStorageDatabase>;
}

export class RemoteUserDataProfileStorageService extends AbstractUserDataProfileStorageService implements IUserDataProfileStorageService {

	private readonly _onDidChange: Emitter<IProfileStorageChanges>;
	readonly onDidChange: Event<IProfileStorageChanges>;

	constructor(
		private readonly remoteService: IRemoteService,
		userDataProfilesService: IUserDataProfilesService,
		storageService: IStorageService,
		logService: ILogService,
	) {
		super(storageService);

		const channel = remoteService.getChannel('profileStorageListener');
		const disposable = this._register(new MutableDisposable());
		this._onDidChange = this._register(new Emitter<IProfileStorageChanges>({
			// Start listening to profile storage changes only when someone is listening
			onWillAddFirstListener: () => {
				disposable.value = channel.listen<IProfileStorageChanges>('onDidChange')(e => {
					logService.trace('profile storage changes', e);
					this._onDidChange.fire({
						targetChanges: e.targetChanges.map(profile => reviveProfile(profile, userDataProfilesService.profilesHome.scheme)),
						valueChanges: e.valueChanges.map(e => ({ ...e, profile: reviveProfile(e.profile, userDataProfilesService.profilesHome.scheme) }))
					});
				});
			},
			// Stop listening to profile storage changes when no one is listening
			onDidRemoveLastListener: () => disposable.value = undefined
		}));
		this.onDidChange = this._onDidChange.event;
	}

	protected async createStorageDatabase(profile: IUserDataProfile): Promise<IStorageDatabase> {
		const storageChannel = this.remoteService.getChannel('storage');
		return isProfileUsingDefaultStorage(profile) ? new ApplicationStorageDatabaseClient(storageChannel) : new ProfileStorageDatabaseClient(storageChannel, profile);
	}
}

class StorageService extends AbstractStorageService {

	private readonly profileStorage: IStorage;

	constructor(profileStorageDatabase: IStorageDatabase) {
		super({ flushInterval: 100 });
		this.profileStorage = this._register(new Storage(profileStorageDatabase));
	}

	protected doInitialize(): Promise<void> {
		return this.profileStorage.init();
	}

	protected getStorage(scope: StorageScope): IStorage | undefined {
		return scope === StorageScope.PROFILE ? this.profileStorage : undefined;
	}

	protected getLogDetails(): string | undefined { return undefined; }
	protected async switchToProfile(): Promise<void> { }
	protected async switchToWorkspace(): Promise<void> { }
	hasScope() { return false; }
}
