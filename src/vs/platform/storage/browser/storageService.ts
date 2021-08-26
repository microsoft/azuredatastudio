/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { StorageScope, IS_NEW_KEY, AbstractStorageService, StorageTarget } from 'vs/platform/storage/common/storage';
import { IWorkspaceInitializationPayload } from 'vs/platform/workspaces/common/workspaces';
import { IStorage, Storage, IStorageDatabase, IUpdateRequest, InMemoryStorageDatabase } from 'vs/base/parts/storage/common/storage';
import { Promises } from 'vs/base/common/async';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { joinPath } from 'vs/base/common/resources';

export class BrowserStorageService extends AbstractStorageService {

	private static BROWSER_DEFAULT_FLUSH_INTERVAL = 5 * 1000; // every 5s because async operations are not permitted on shutdown

	private globalStorage: IStorage | undefined;
	private workspaceStorage: IStorage | undefined;

	private globalStorageDatabase: IIndexedDBStorageDatabase | undefined;
	private workspaceStorageDatabase: IIndexedDBStorageDatabase | undefined;

	get hasPendingUpdate(): boolean {
		return Boolean(this.globalStorageDatabase?.hasPendingUpdate || this.workspaceStorageDatabase?.hasPendingUpdate);
	}

	constructor(
		private readonly payload: IWorkspaceInitializationPayload,
		@ILogService private readonly logService: ILogService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IFileService private readonly fileService: IFileService
	) {
		super({ flushInterval: BrowserStorageService.BROWSER_DEFAULT_FLUSH_INTERVAL });
	}

	private getId(scope: StorageScope): string {
		return scope === StorageScope.GLOBAL ? 'global' : this.payload.id;
	}

	protected async doInitialize(): Promise<void> {

		// Create Storage in Parallel
		const [workspaceStorageDatabase, globalStorageDatabase] = await Promises.settled([
			IndexedDBStorageDatabase.create(this.getId(StorageScope.WORKSPACE), this.logService),
			IndexedDBStorageDatabase.create(this.getId(StorageScope.GLOBAL), this.logService)
		]);

		// Workspace Storage
		this.workspaceStorageDatabase = this._register(workspaceStorageDatabase);
		this.workspaceStorage = this._register(new Storage(this.workspaceStorageDatabase));
		this._register(this.workspaceStorage.onDidChangeStorage(key => this.emitDidChangeValue(StorageScope.WORKSPACE, key)));

		// Global Storage
		this.globalStorageDatabase = this._register(globalStorageDatabase);
		this.globalStorage = this._register(new Storage(this.globalStorageDatabase));
		this._register(this.globalStorage.onDidChangeStorage(key => this.emitDidChangeValue(StorageScope.GLOBAL, key)));

		// Init both
		await Promises.settled([
			this.workspaceStorage.init(),
			this.globalStorage.init()
		]);

		// Check to see if this is the first time we are "opening" the application
		const firstOpen = this.globalStorage.getBoolean(IS_NEW_KEY);
		if (firstOpen === undefined) {
			await this.migrateOldStorage(StorageScope.GLOBAL); // TODO@bpasero remove browser storage migration
			this.globalStorage.set(IS_NEW_KEY, true);
		} else if (firstOpen) {
			this.globalStorage.set(IS_NEW_KEY, false);
		}

		// Check to see if this is the first time we are "opening" this workspace
		const firstWorkspaceOpen = this.workspaceStorage.getBoolean(IS_NEW_KEY);
		if (firstWorkspaceOpen === undefined) {
			await this.migrateOldStorage(StorageScope.WORKSPACE); // TODO@bpasero remove browser storage migration
			this.workspaceStorage.set(IS_NEW_KEY, true);
		} else if (firstWorkspaceOpen) {
			this.workspaceStorage.set(IS_NEW_KEY, false);
		}
	}

	private async migrateOldStorage(scope: StorageScope): Promise<void> {
		try {
			const stateRoot = joinPath(this.environmentService.userRoamingDataHome, 'state');

			if (scope === StorageScope.GLOBAL) {
				const globalStorageFile = joinPath(stateRoot, 'global.json');
				const globalItemsRaw = await this.fileService.readFile(globalStorageFile);
				const globalItems = new Map<string, string>(JSON.parse(globalItemsRaw.value.toString()));

				for (const [key, value] of globalItems) {
					this.globalStorage?.set(key, value);
				}

				await this.fileService.del(globalStorageFile);
			} else if (scope === StorageScope.WORKSPACE) {
				const workspaceStorageFile = joinPath(stateRoot, `${this.payload.id}.json`);
				const workspaceItemsRaw = await this.fileService.readFile(workspaceStorageFile);
				const workspaceItems = new Map<string, string>(JSON.parse(workspaceItemsRaw.value.toString()));

				for (const [key, value] of workspaceItems) {
					this.workspaceStorage?.set(key, value);
				}

				await this.fileService.del(workspaceStorageFile);
			}
		} catch (error) {
			// ignore
		}
	}

	protected getStorage(scope: StorageScope): IStorage | undefined {
		return scope === StorageScope.GLOBAL ? this.globalStorage : this.workspaceStorage;
	}

	protected getLogDetails(scope: StorageScope): string | undefined {
		return this.getId(scope);
	}

	async migrate(toWorkspace: IWorkspaceInitializationPayload): Promise<void> {
		throw new Error('Migrating storage is currently unsupported in Web');
	}

	protected override shouldFlushWhenIdle(): boolean {
		// this flush() will potentially cause new state to be stored
		// since new state will only be created while the document
		// has focus, one optimization is to not run this when the
		// document has no focus, assuming that state has not changed
		//
		// another optimization is to not collect more state if we
		// have a pending update already running which indicates
		// that the connection is either slow or disconnected and
		// thus unhealthy.
		return document.hasFocus() && !this.hasPendingUpdate;
	}

	close(): void {
		// We explicitly do not close our DBs because writing data onBeforeUnload()
		// can result in unexpected results. Namely, it seems that - even though this
		// operation is async - sometimes it is being triggered on unload and
		// succeeds. Often though, the DBs turn out to be empty because the write
		// never had a chance to complete.
		//
		// Instead we trigger dispose() to ensure that no timeouts or callbacks
		// get triggered in this phase.
		this.dispose();
	}

	async clear(): Promise<void> {

		// Clear key/values
		for (const scope of [StorageScope.GLOBAL, StorageScope.WORKSPACE]) {
			for (const target of [StorageTarget.USER, StorageTarget.MACHINE]) {
				for (const key of this.keys(scope, target)) {
					this.remove(key, scope);
				}
			}

			await this.getStorage(scope)?.whenFlushed();
		}

		// Clear databases
		await Promises.settled([
			this.globalStorageDatabase?.clear() ?? Promise.resolve(),
			this.workspaceStorageDatabase?.clear() ?? Promise.resolve()
		]);
	}
}

interface IIndexedDBStorageDatabase extends IStorageDatabase, IDisposable {

	/**
	 * Whether an update in the DB is currently pending
	 * (either update or delete operation).
	 */
	readonly hasPendingUpdate: boolean;

	/**
	 * For testing only.
	 */
	clear(): Promise<void>;
}

class InMemoryIndexedDBStorageDatabase extends InMemoryStorageDatabase implements IIndexedDBStorageDatabase {

	readonly hasPendingUpdate = false;

	async clear(): Promise<void> {
		(await this.getItems()).clear();
	}

	dispose(): void {
		// No-op
	}
}

export class IndexedDBStorageDatabase extends Disposable implements IIndexedDBStorageDatabase {

	static async create(id: string, logService: ILogService): Promise<IIndexedDBStorageDatabase> {
		try {
			const database = new IndexedDBStorageDatabase(id, logService);
			await database.whenConnected;

			return database;
		} catch (error) {
			logService.error(`[IndexedDB Storage ${id}] create(): ${toErrorMessage(error, true)}`);

			return new InMemoryIndexedDBStorageDatabase();
		}
	}

	private static readonly STORAGE_DATABASE_PREFIX = 'vscode-web-state-db-';
	private static readonly STORAGE_OBJECT_STORE = 'ItemTable';

	readonly onDidChangeItemsExternal = Event.None; // IndexedDB currently does not support observers (https://github.com/w3c/IndexedDB/issues/51)

	private pendingUpdate: Promise<void> | undefined = undefined;
	get hasPendingUpdate(): boolean { return !!this.pendingUpdate; }

	private readonly name: string;
	private readonly whenConnected: Promise<IDBDatabase>;

	private constructor(
		id: string,
		private readonly logService: ILogService
	) {
		super();

		this.name = `${IndexedDBStorageDatabase.STORAGE_DATABASE_PREFIX}${id}`;
		this.whenConnected = this.connect();
	}

	private connect(): Promise<IDBDatabase> {
		return new Promise<IDBDatabase>((resolve, reject) => {
			const request = window.indexedDB.open(this.name);

			// Create `ItemTable` object-store when this DB is new
			request.onupgradeneeded = () => {
				request.result.createObjectStore(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE);
			};

			// IndexedDB opened successfully
			request.onsuccess = () => resolve(request.result);

			// Fail on error (we will then fallback to in-memory DB)
			request.onerror = () => reject(request.error);
		});
	}

	getItems(): Promise<Map<string, string>> {
		return new Promise<Map<string, string>>(async resolve => {
			const items = new Map<string, string>();

			// Open a IndexedDB Cursor to iterate over key/values
			const db = await this.whenConnected;
			const transaction = db.transaction(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE, 'readonly');
			const objectStore = transaction.objectStore(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE);
			const cursor = objectStore.openCursor();
			if (!cursor) {
				return resolve(items); // this means the `ItemTable` was empty
			}

			// Iterate over rows of `ItemTable` until the end
			cursor.onsuccess = () => {
				if (cursor.result) {

					// Keep cursor key/value in our map
					if (typeof cursor.result.value === 'string') {
						items.set(cursor.result.key.toString(), cursor.result.value);
					}

					// Advance cursor to next row
					cursor.result.continue();
				} else {
					resolve(items); // reached end of table
				}
			};

			const onError = (error: Error | null) => {
				this.logService.error(`[IndexedDB Storage ${this.name}] getItems(): ${toErrorMessage(error, true)}`);

				resolve(items);
			};

			// Error handlers
			cursor.onerror = () => onError(cursor.error);
			transaction.onerror = () => onError(transaction.error);
		});
	}

	async updateItems(request: IUpdateRequest): Promise<void> {
		this.pendingUpdate = this.doUpdateItems(request);
		try {
			await this.pendingUpdate;
		} finally {
			this.pendingUpdate = undefined;
		}
	}

	private async doUpdateItems(request: IUpdateRequest): Promise<void> {

		// Return early if the request is empty
		const toInsert = request.insert;
		const toDelete = request.delete;
		if ((!toInsert && !toDelete) || (toInsert?.size === 0 && toDelete?.size === 0)) {
			return;
		}

		// Update `ItemTable` with inserts and/or deletes
		return new Promise<void>(async (resolve, reject) => {
			const db = await this.whenConnected;

			const transaction = db.transaction(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE, 'readwrite');
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);

			const objectStore = transaction.objectStore(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE);

			// Inserts
			if (toInsert) {
				for (const [key, value] of toInsert) {
					objectStore.put(value, key);
				}
			}

			// Deletes
			if (toDelete) {
				for (const key of toDelete) {
					objectStore.delete(key);
				}
			}
		});
	}

	async close(): Promise<void> {
		const db = await this.whenConnected;

		// Wait for pending updates to having finished
		await this.pendingUpdate;

		// Finally, close IndexedDB
		return db.close();
	}

	clear(): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			const db = await this.whenConnected;

			const transaction = db.transaction(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE, 'readwrite');
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);

			// Clear every row in the `ItemTable`
			const objectStore = transaction.objectStore(IndexedDBStorageDatabase.STORAGE_OBJECT_STORE);
			objectStore.clear();
		});
	}
}
