/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Promises, RunOnceScheduler, runWhenIdle } from 'vs/base/common/async';
import { Emitter, Event, PauseableEmitter } from 'vs/base/common/event';
import { Disposable, dispose, MutableDisposable } from 'vs/base/common/lifecycle';
import { mark } from 'vs/base/common/performance';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { InMemoryStorageDatabase, IStorage, Storage } from 'vs/base/parts/storage/common/storage';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { isUserDataProfile, IUserDataProfile } from 'vs/platform/userDataProfile/common/userDataProfile';
import { IAnyWorkspaceIdentifier } from 'vs/platform/workspace/common/workspace';

export const IS_NEW_KEY = '__$__isNewStorageMarker';
const TARGET_KEY = '__$__targetStorageMarker';

export const IStorageService = createDecorator<IStorageService>('storageService');

export enum WillSaveStateReason {

	/**
	 * No specific reason to save state.
	 */
	NONE,

	/**
	 * A hint that the workbench is about to shutdown.
	 */
	SHUTDOWN
}

export interface IWillSaveStateEvent {
	readonly reason: WillSaveStateReason;
}

export interface IStorageService {

	readonly _serviceBrand: undefined;

	/**
	 * Emitted whenever data is updated or deleted.
	 */
	readonly onDidChangeValue: Event<IStorageValueChangeEvent>;

	/**
	 * Emitted whenever target of a storage entry changes.
	 */
	readonly onDidChangeTarget: Event<IStorageTargetChangeEvent>;

	/**
	 * Emitted when the storage is about to persist. This is the right time
	 * to persist data to ensure it is stored before the application shuts
	 * down.
	 *
	 * The will save state event allows to optionally ask for the reason of
	 * saving the state, e.g. to find out if the state is saved due to a
	 * shutdown.
	 *
	 * Note: this event may be fired many times, not only on shutdown to prevent
	 * loss of state in situations where the shutdown is not sufficient to
	 * persist the data properly.
	 */
	readonly onWillSaveState: Event<IWillSaveStateEvent>;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 * The element will be converted to a `boolean`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	getBoolean(key: string, scope: StorageScope, fallbackValue: boolean): boolean;
	getBoolean(key: string, scope: StorageScope, fallbackValue?: boolean): boolean | undefined;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 * The element will be converted to a `number` using `parseInt` with a
	 * base of `10`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	getNumber(key: string, scope: StorageScope, fallbackValue: number): number;
	getNumber(key: string, scope: StorageScope, fallbackValue?: number): number | undefined;

	/**
	 * Store a value under the given key to storage. The value will be
	 * converted to a `string`. Storing either `undefined` or `null` will
	 * remove the entry under the key.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 *
	 * @param target allows to define the target of the storage operation
	 * to either the current machine or user.
	 */
	store(key: string, value: string | boolean | number | undefined | null, scope: StorageScope, target: StorageTarget): void;

	/**
	 * Delete an element stored under the provided key from storage.
	 *
	 * The scope argument allows to define the scope of the storage
	 * operation to either the current workspace only, all workspaces
	 * or all profiles.
	 */
	remove(key: string, scope: StorageScope): void;

	/**
	 * Returns all the keys used in the storage for the provided `scope`
	 * and `target`.
	 *
	 * Note: this will NOT return all keys stored in the storage layer.
	 * Some keys may not have an associated `StorageTarget` and thus
	 * will be excluded from the results.
	 *
	 * @param scope allows to define the scope for the keys
	 * to either the current workspace only, all workspaces or all profiles.
	 *
	 * @param target allows to define the target for the keys
	 * to either the current machine or user.
	 */
	keys(scope: StorageScope, target: StorageTarget): string[];

	/**
	 * Log the contents of the storage to the console.
	 */
	log(): void;

	/**
	 * Switch storage to another workspace or profile. Optionally preserve the
	 * current data to the new storage.
	 */
	switch(to: IAnyWorkspaceIdentifier | IUserDataProfile, preserveData: boolean): Promise<void>;

	/**
	 * Whether the storage for the given scope was created during this session or
	 * existed before.
	 */
	isNew(scope: StorageScope): boolean;

	/**
	 * Allows to flush state, e.g. in cases where a shutdown is
	 * imminent. This will send out the `onWillSaveState` to ask
	 * everyone for latest state.
	 *
	 * @returns a `Promise` that can be awaited on when all updates
	 * to the underlying storage have been flushed.
	 */
	flush(reason?: WillSaveStateReason): Promise<void>;
}

export const enum StorageScope {

	/**
	 * The stored data will be scoped to all workspaces across all profiles.
	 */
	APPLICATION = -1,

	/**
	 * The stored data will be scoped to all workspaces of the same profile.
	 */
	PROFILE = 0,

	/**
	 * The stored data will be scoped to the current workspace.
	 */
	WORKSPACE = 1
}

export const enum StorageTarget {

	/**
	 * The stored data is user specific and applies across machines.
	 */
	USER,

	/**
	 * The stored data is machine specific.
	 */
	MACHINE
}

export interface IStorageValueChangeEvent {

	/**
	 * The scope for the storage entry that changed
	 * or was removed.
	 */
	readonly scope: StorageScope;

	/**
	 * The `key` of the storage entry that was changed
	 * or was removed.
	 */
	readonly key: string;

	/**
	 * The `target` can be `undefined` if a key is being
	 * removed.
	 */
	readonly target: StorageTarget | undefined;
}

export interface IStorageTargetChangeEvent {

	/**
	 * The scope for the target that changed. Listeners
	 * should use `keys(scope, target)` to get an updated
	 * list of keys for the given `scope` and `target`.
	 */
	readonly scope: StorageScope;
}

interface IKeyTargets {
	[key: string]: StorageTarget;
}

export interface IStorageServiceOptions {
	flushInterval: number;
}

export abstract class AbstractStorageService extends Disposable implements IStorageService {

	declare readonly _serviceBrand: undefined;

	private static DEFAULT_FLUSH_INTERVAL = 60 * 1000; // every minute

	private readonly _onDidChangeValue = this._register(new PauseableEmitter<IStorageValueChangeEvent>());
	readonly onDidChangeValue = this._onDidChangeValue.event;

	private readonly _onDidChangeTarget = this._register(new PauseableEmitter<IStorageTargetChangeEvent>());
	readonly onDidChangeTarget = this._onDidChangeTarget.event;

	private readonly _onWillSaveState = this._register(new Emitter<IWillSaveStateEvent>());
	readonly onWillSaveState = this._onWillSaveState.event;

	private initializationPromise: Promise<void> | undefined;

	private readonly flushWhenIdleScheduler = this._register(new RunOnceScheduler(() => this.doFlushWhenIdle(), this.options.flushInterval));
	private readonly runFlushWhenIdle = this._register(new MutableDisposable());

	constructor(private readonly options: IStorageServiceOptions = { flushInterval: AbstractStorageService.DEFAULT_FLUSH_INTERVAL }) {
		super();
	}

	private doFlushWhenIdle(): void {
		this.runFlushWhenIdle.value = runWhenIdle(() => {
			if (this.shouldFlushWhenIdle()) {
				this.flush();
			}

			// repeat
			this.flushWhenIdleScheduler.schedule();
		});
	}

	protected shouldFlushWhenIdle(): boolean {
		return true;
	}

	protected stopFlushWhenIdle(): void {
		dispose([this.runFlushWhenIdle, this.flushWhenIdleScheduler]);
	}

	initialize(): Promise<void> {
		if (!this.initializationPromise) {
			this.initializationPromise = (async () => {

				// Init all storage locations
				mark('code/willInitStorage');
				try {
					// Ask subclasses to initialize storage
					await this.doInitialize();
				} finally {
					mark('code/didInitStorage');
				}

				// On some OS we do not get enough time to persist state on shutdown (e.g. when
				// Windows restarts after applying updates). In other cases, VSCode might crash,
				// so we periodically save state to reduce the chance of loosing any state.
				// In the browser we do not have support for long running unload sequences. As such,
				// we cannot ask for saving state in that moment, because that would result in a
				// long running operation.
				// Instead, periodically ask customers to save save. The library will be clever enough
				// to only save state that has actually changed.
				this.flushWhenIdleScheduler.schedule();
			})();
		}

		return this.initializationPromise;
	}

	protected emitDidChangeValue(scope: StorageScope, key: string): void {

		// Specially handle `TARGET_KEY`
		if (key === TARGET_KEY) {

			// Clear our cached version which is now out of date
			switch (scope) {
				case StorageScope.APPLICATION:
					this._applicationKeyTargets = undefined;
					break;
				case StorageScope.PROFILE:
					this._profileKeyTargets = undefined;
					break;
				case StorageScope.WORKSPACE:
					this._workspaceKeyTargets = undefined;
					break;
			}

			// Emit as `didChangeTarget` event
			this._onDidChangeTarget.fire({ scope });
		}

		// Emit any other key to outside
		else {
			this._onDidChangeValue.fire({ scope, key, target: this.getKeyTargets(scope)[key] });
		}
	}

	protected emitWillSaveState(reason: WillSaveStateReason): void {
		this._onWillSaveState.fire({ reason });
	}

	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope): string | undefined;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined {
		return this.getStorage(scope)?.get(key, fallbackValue);
	}

	getBoolean(key: string, scope: StorageScope, fallbackValue: boolean): boolean;
	getBoolean(key: string, scope: StorageScope): boolean | undefined;
	getBoolean(key: string, scope: StorageScope, fallbackValue?: boolean): boolean | undefined {
		return this.getStorage(scope)?.getBoolean(key, fallbackValue);
	}

	getNumber(key: string, scope: StorageScope, fallbackValue: number): number;
	getNumber(key: string, scope: StorageScope): number | undefined;
	getNumber(key: string, scope: StorageScope, fallbackValue?: number): number | undefined {
		return this.getStorage(scope)?.getNumber(key, fallbackValue);
	}

	store(key: string, value: string | boolean | number | undefined | null, scope: StorageScope, target: StorageTarget): void {

		// We remove the key for undefined/null values
		if (isUndefinedOrNull(value)) {
			this.remove(key, scope);
			return;
		}

		// Update our datastructures but send events only after
		this.withPausedEmitters(() => {

			// Update key-target map
			this.updateKeyTarget(key, scope, target);

			// Store actual value
			this.getStorage(scope)?.set(key, value);
		});
	}

	remove(key: string, scope: StorageScope): void {

		// Update our datastructures but send events only after
		this.withPausedEmitters(() => {

			// Update key-target map
			this.updateKeyTarget(key, scope, undefined);

			// Remove actual key
			this.getStorage(scope)?.delete(key);
		});
	}

	private withPausedEmitters(fn: Function): void {

		// Pause emitters
		this._onDidChangeValue.pause();
		this._onDidChangeTarget.pause();

		try {
			fn();
		} finally {

			// Resume emitters
			this._onDidChangeValue.resume();
			this._onDidChangeTarget.resume();
		}
	}

	keys(scope: StorageScope, target: StorageTarget): string[] {
		const keys: string[] = [];

		const keyTargets = this.getKeyTargets(scope);
		for (const key of Object.keys(keyTargets)) {
			const keyTarget = keyTargets[key];
			if (keyTarget === target) {
				keys.push(key);
			}
		}

		return keys;
	}

	private updateKeyTarget(key: string, scope: StorageScope, target: StorageTarget | undefined): void {

		// Add
		const keyTargets = this.getKeyTargets(scope);
		if (typeof target === 'number') {
			if (keyTargets[key] !== target) {
				keyTargets[key] = target;
				this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets));
			}
		}

		// Remove
		else {
			if (typeof keyTargets[key] === 'number') {
				delete keyTargets[key];
				this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets));
			}
		}
	}

	private _workspaceKeyTargets: IKeyTargets | undefined = undefined;
	private get workspaceKeyTargets(): IKeyTargets {
		if (!this._workspaceKeyTargets) {
			this._workspaceKeyTargets = this.loadKeyTargets(StorageScope.WORKSPACE);
		}

		return this._workspaceKeyTargets;
	}

	private _profileKeyTargets: IKeyTargets | undefined = undefined;
	private get profileKeyTargets(): IKeyTargets {
		if (!this._profileKeyTargets) {
			this._profileKeyTargets = this.loadKeyTargets(StorageScope.PROFILE);
		}

		return this._profileKeyTargets;
	}

	private _applicationKeyTargets: IKeyTargets | undefined = undefined;
	private get applicationKeyTargets(): IKeyTargets {
		if (!this._applicationKeyTargets) {
			this._applicationKeyTargets = this.loadKeyTargets(StorageScope.APPLICATION);
		}

		return this._applicationKeyTargets;
	}

	private getKeyTargets(scope: StorageScope): IKeyTargets {
		switch (scope) {
			case StorageScope.APPLICATION:
				return this.applicationKeyTargets;
			case StorageScope.PROFILE:
				return this.profileKeyTargets;
			default:
				return this.workspaceKeyTargets;
		}
	}

	private loadKeyTargets(scope: StorageScope): { [key: string]: StorageTarget } {
		const keysRaw = this.get(TARGET_KEY, scope);
		if (keysRaw) {
			try {
				return JSON.parse(keysRaw);
			} catch (error) {
				// Fail gracefully
			}
		}

		return Object.create(null);
	}

	isNew(scope: StorageScope): boolean {
		return this.getBoolean(IS_NEW_KEY, scope) === true;
	}

	async flush(reason = WillSaveStateReason.NONE): Promise<void> {

		// Signal event to collect changes
		this._onWillSaveState.fire({ reason });

		const applicationStorage = this.getStorage(StorageScope.APPLICATION);
		const profileStorage = this.getStorage(StorageScope.PROFILE);
		const workspaceStorage = this.getStorage(StorageScope.WORKSPACE);

		switch (reason) {

			// Unspecific reason: just wait when data is flushed
			case WillSaveStateReason.NONE:
				await Promises.settled([
					applicationStorage?.whenFlushed() ?? Promise.resolve(),
					profileStorage?.whenFlushed() ?? Promise.resolve(),
					workspaceStorage?.whenFlushed() ?? Promise.resolve()
				]);
				break;

			// Shutdown: we want to flush as soon as possible
			// and not hit any delays that might be there
			case WillSaveStateReason.SHUTDOWN:
				await Promises.settled([
					applicationStorage?.flush(0) ?? Promise.resolve(),
					profileStorage?.flush(0) ?? Promise.resolve(),
					workspaceStorage?.flush(0) ?? Promise.resolve()
				]);
				break;
		}
	}

	async log(): Promise<void> {
		const applicationItems = this.getStorage(StorageScope.APPLICATION)?.items ?? new Map<string, string>();
		const profileItems = this.getStorage(StorageScope.PROFILE)?.items ?? new Map<string, string>();
		const workspaceItems = this.getStorage(StorageScope.WORKSPACE)?.items ?? new Map<string, string>();

		return logStorage(
			applicationItems,
			profileItems,
			workspaceItems,
			this.getLogDetails(StorageScope.APPLICATION) ?? '',
			this.getLogDetails(StorageScope.PROFILE) ?? '',
			this.getLogDetails(StorageScope.WORKSPACE) ?? ''
		);
	}

	async switch(to: IAnyWorkspaceIdentifier | IUserDataProfile, preserveData: boolean): Promise<void> {

		// Signal as event so that clients can store data before we switch
		this.emitWillSaveState(WillSaveStateReason.NONE);

		if (isUserDataProfile(to)) {
			return this.switchToProfile(to, preserveData);
		}

		return this.switchToWorkspace(to, preserveData);
	}

	protected canSwitchProfile(from: IUserDataProfile, to: IUserDataProfile): boolean {
		if (from.id === to.id) {
			return false; // both profiles are same
		}

		if (isProfileUsingDefaultStorage(to) && isProfileUsingDefaultStorage(from)) {
			return false; // both profiles are using default
		}

		return true;
	}

	protected switchData(oldStorage: Map<string, string>, newStorage: IStorage, scope: StorageScope, preserveData: boolean): void {
		this.withPausedEmitters(() => {

			// Copy over previous keys if `preserveData`
			if (preserveData) {
				for (const [key, value] of oldStorage) {
					newStorage.set(key, value);
				}
			}

			// Otherwise signal storage keys that have changed
			else {
				const handledkeys = new Set<string>();
				for (const [key, oldValue] of oldStorage) {
					handledkeys.add(key);

					const newValue = newStorage.get(key);
					if (newValue !== oldValue) {
						this.emitDidChangeValue(scope, key);
					}
				}

				for (const [key] of newStorage.items) {
					if (!handledkeys.has(key)) {
						this.emitDidChangeValue(scope, key);
					}
				}
			}
		});
	}

	// --- abstract

	protected abstract doInitialize(): Promise<void>;

	protected abstract getStorage(scope: StorageScope): IStorage | undefined;

	protected abstract getLogDetails(scope: StorageScope): string | undefined;

	protected abstract switchToProfile(toProfile: IUserDataProfile, preserveData: boolean): Promise<void>;
	protected abstract switchToWorkspace(toWorkspace: IAnyWorkspaceIdentifier | IUserDataProfile, preserveData: boolean): Promise<void>;
}

export function isProfileUsingDefaultStorage(profile: IUserDataProfile): boolean {
	return profile.isDefault || !!profile.useDefaultFlags?.uiState;
}

export class InMemoryStorageService extends AbstractStorageService {

	private readonly applicationStorage = this._register(new Storage(new InMemoryStorageDatabase()));
	private readonly profileStorage = this._register(new Storage(new InMemoryStorageDatabase()));
	private readonly workspaceStorage = this._register(new Storage(new InMemoryStorageDatabase()));

	constructor() {
		super();

		this._register(this.workspaceStorage.onDidChangeStorage(key => this.emitDidChangeValue(StorageScope.WORKSPACE, key)));
		this._register(this.profileStorage.onDidChangeStorage(key => this.emitDidChangeValue(StorageScope.PROFILE, key)));
		this._register(this.applicationStorage.onDidChangeStorage(key => this.emitDidChangeValue(StorageScope.APPLICATION, key)));
	}

	protected getStorage(scope: StorageScope): IStorage {
		switch (scope) {
			case StorageScope.APPLICATION:
				return this.applicationStorage;
			case StorageScope.PROFILE:
				return this.profileStorage;
			default:
				return this.workspaceStorage;
		}
	}

	protected getLogDetails(scope: StorageScope): string | undefined {
		switch (scope) {
			case StorageScope.APPLICATION:
				return 'inMemory (application)';
			case StorageScope.PROFILE:
				return 'inMemory (profile)';
			default:
				return 'inMemory (workspace)';
		}
	}

	protected async doInitialize(): Promise<void> { }

	protected async switchToProfile(): Promise<void> {
		// no-op when in-memory
	}

	protected async switchToWorkspace(): Promise<void> {
		// no-op when in-memory
	}
}

export async function logStorage(application: Map<string, string>, profile: Map<string, string>, workspace: Map<string, string>, applicationPath: string, profilePath: string, workspacePath: string): Promise<void> {
	const safeParse = (value: string) => {
		try {
			return JSON.parse(value);
		} catch (error) {
			return value;
		}
	};

	const applicationItems = new Map<string, string>();
	const applicationItemsParsed = new Map<string, string>();
	application.forEach((value, key) => {
		applicationItems.set(key, value);
		applicationItemsParsed.set(key, safeParse(value));
	});

	const profileItems = new Map<string, string>();
	const profileItemsParsed = new Map<string, string>();
	profile.forEach((value, key) => {
		profileItems.set(key, value);
		profileItemsParsed.set(key, safeParse(value));
	});

	const workspaceItems = new Map<string, string>();
	const workspaceItemsParsed = new Map<string, string>();
	workspace.forEach((value, key) => {
		workspaceItems.set(key, value);
		workspaceItemsParsed.set(key, safeParse(value));
	});

	if (applicationPath !== profilePath) {
		console.group(`Storage: Application (path: ${applicationPath})`);
	} else {
		console.group(`Storage: Application & Profile (path: ${applicationPath}, default profile)`);
	}
	const applicationValues: { key: string; value: string }[] = [];
	applicationItems.forEach((value, key) => {
		applicationValues.push({ key, value });
	});
	console.table(applicationValues);
	console.groupEnd();

	console.log(applicationItemsParsed);

	if (applicationPath !== profilePath) {
		console.group(`Storage: Profile (path: ${profilePath}, profile specific)`);
		const profileValues: { key: string; value: string }[] = [];
		profileItems.forEach((value, key) => {
			profileValues.push({ key, value });
		});
		console.table(profileValues);
		console.groupEnd();

		console.log(profileItemsParsed);
	}

	console.group(`Storage: Workspace (path: ${workspacePath})`);
	const workspaceValues: { key: string; value: string }[] = [];
	workspaceItems.forEach((value, key) => {
		workspaceValues.push({ key, value });
	});
	console.table(workspaceValues);
	console.groupEnd();

	console.log(workspaceItemsParsed);
}
