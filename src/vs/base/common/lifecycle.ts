/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { once } from 'vs/base/common/functional';
import { Iterable } from 'vs/base/common/iterator';

// #region Disposable Tracking

/**
 * Enables logging of potentially leaked disposables.
 *
 * A disposable is considered leaked if it is not disposed or not registered as the child of
 * another disposable. This tracking is very simple an only works for classes that either
 * extend Disposable or use a DisposableStore. This means there are a lot of false positives.
 */
const TRACK_DISPOSABLES = false;
let disposableTracker: IDisposableTracker | null = null;

export interface IDisposableTracker {
	/**
	 * Is called on construction of a disposable.
	*/
	trackDisposable(disposable: IDisposable): void;

	/**
	 * Is called when a disposable is registered as child of another disposable (e.g. {@link DisposableStore}).
	 * If parent is `null`, the disposable is removed from its former parent.
	*/
	setParent(child: IDisposable, parent: IDisposable | null): void;

	/**
	 * Is called after a disposable is disposed.
	*/
	markAsDisposed(disposable: IDisposable): void;

	/**
	 * Indicates that the given object is a singleton which does not need to be disposed.
	*/
	markAsSingleton(disposable: IDisposable): void;
}

export function setDisposableTracker(tracker: IDisposableTracker | null): void {
	disposableTracker = tracker;
}

if (TRACK_DISPOSABLES) {
	const __is_disposable_tracked__ = '__is_disposable_tracked__';
	setDisposableTracker(new class implements IDisposableTracker {
		trackDisposable(x: IDisposable): void {
			const stack = new Error('Potentially leaked disposable').stack!;
			setTimeout(() => {
				if (!(x as any)[__is_disposable_tracked__]) {
					console.log(stack);
				}
			}, 3000);
		}

		setParent(child: IDisposable, parent: IDisposable | null): void {
			if (child && child !== Disposable.None) {
				try {
					(child as any)[__is_disposable_tracked__] = true;
				} catch {
					// noop
				}
			}
		}

		markAsDisposed(disposable: IDisposable): void {
			if (disposable && disposable !== Disposable.None) {
				try {
					(disposable as any)[__is_disposable_tracked__] = true;
				} catch {
					// noop
				}
			}
		}
		markAsSingleton(disposable: IDisposable): void { }
	});
}

function trackDisposable<T extends IDisposable>(x: T): T {
	disposableTracker?.trackDisposable(x);
	return x;
}

function markAsDisposed(disposable: IDisposable): void {
	disposableTracker?.markAsDisposed(disposable);
}

function setParentOfDisposable(child: IDisposable, parent: IDisposable | null): void {
	disposableTracker?.setParent(child, parent);
}

function setParentOfDisposables(children: IDisposable[], parent: IDisposable | null): void {
	if (!disposableTracker) {
		return;
	}
	for (const child of children) {
		disposableTracker.setParent(child, parent);
	}
}

/**
 * Indicates that the given object is a singleton which does not need to be disposed.
*/
export function markAsSingleton<T extends IDisposable>(singleton: T): T {
	disposableTracker?.markAsSingleton(singleton);
	return singleton;
}

// #endregion

/**
 * An object that performs a cleanup operation when `.dispose()` is called.
 *
 * Some examples of how disposables are used:
 *
 * - An event listener that removes itself when `.dispose()` is called.
 * - A resource such as a file system watcher that cleans up the resource when `.dispose()` is called.
 * - The return value from registering a provider. When `.dispose()` is called, the provider is unregistered.
 */
export interface IDisposable {
	dispose(): void;
}

/**
 * Check if `thing` is {@link IDisposable disposable}.
 */
export function isDisposable<E extends object>(thing: E): thing is E & IDisposable {
	return typeof (<IDisposable>thing).dispose === 'function' && (<IDisposable>thing).dispose.length === 0;
}

/**
 * Disposes of the value(s) passed in.
 */
export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
export function dispose<T extends IDisposable, A extends Iterable<T> = Iterable<T>>(disposables: A): A;
export function dispose<T extends IDisposable>(disposables: Array<T>): Array<T>;
export function dispose<T extends IDisposable>(disposables: ReadonlyArray<T>): ReadonlyArray<T>;
export function dispose<T extends IDisposable>(arg: T | Iterable<T> | undefined): any {
	if (Iterable.is(arg)) {
		const errors: any[] = [];

		for (const d of arg) {
			if (d) {
				try {
					d.dispose();
				} catch (e) {
					errors.push(e);
				}
			}
		}

		if (errors.length === 1) {
			throw errors[0];
		} else if (errors.length > 1) {
			throw new AggregateError(errors, 'Encountered errors while disposing of store');
		}

		return Array.isArray(arg) ? [] : arg;
	} else if (arg) {
		arg.dispose();
		return arg;
	}
}

export function disposeIfDisposable<T extends IDisposable | object>(disposables: Array<T>): Array<T> {
	for (const d of disposables) {
		if (isDisposable(d)) {
			d.dispose();
		}
	}
	return [];
}

/**
 * Combine multiple disposable values into a single {@link IDisposable}.
 */
export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
	const parent = toDisposable(() => dispose(disposables));
	setParentOfDisposables(disposables, parent);
	return parent;
}

/**
 * Turn a function that implements dispose into an {@link IDisposable}.
 *
 * @param fn Clean up function, guaranteed to be called only **once**.
 */
export function toDisposable(fn: () => void): IDisposable {
	const self = trackDisposable({
		dispose: once(() => {
			markAsDisposed(self);
			fn();
		})
	});
	return self;
}

/**
 * Manages a collection of disposable values.
 *
 * This is the preferred way to manage multiple disposables. A `DisposableStore` is safer to work with than an
 * `IDisposable[]` as it considers edge cases, such as registering the same value multiple times or adding an item to a
 * store that has already been disposed of.
 */
export class DisposableStore implements IDisposable {

	static DISABLE_DISPOSED_WARNING = false;

	private readonly _toDispose = new Set<IDisposable>();
	private _isDisposed = false;

	constructor() {
		trackDisposable(this);
	}

	/**
	 * Dispose of all registered disposables and mark this object as disposed.
	 *
	 * Any future disposables added to this object will be disposed of on `add`.
	 */
	public dispose(): void {
		if (this._isDisposed) {
			return;
		}

		markAsDisposed(this);
		this._isDisposed = true;
		this.clear();
	}

	/**
	 * @return `true` if this object has been disposed of.
	 */
	public get isDisposed(): boolean {
		return this._isDisposed;
	}

	/**
	 * Dispose of all registered disposables but do not mark this object as disposed.
	 */
	public clear(): void {
		if (this._toDispose.size === 0) {
			return;
		}

		try {
			dispose(this._toDispose);
		} finally {
			this._toDispose.clear();
		}
	}

	/**
	 * Add a new {@link IDisposable disposable} to the collection.
	 */
	public add<T extends IDisposable>(o: T): T {
		if (!o) {
			return o;
		}
		if ((o as unknown as DisposableStore) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}

		setParentOfDisposable(o, this);
		if (this._isDisposed) {
			if (!DisposableStore.DISABLE_DISPOSED_WARNING) {
				console.warn(new Error('Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!').stack);
			}
		} else {
			this._toDispose.add(o);
		}

		return o;
	}
}

/**
 * Abstract base class for a {@link IDisposable disposable} object.
 *
 * Subclasses can {@linkcode _register} disposables that will be automatically cleaned up when this object is disposed of.
 */
export abstract class Disposable implements IDisposable {

	/**
	 * A disposable that does nothing when it is disposed of.
	 *
	 * TODO: This should not be a static property.
	 */
	static readonly None = Object.freeze<IDisposable>({ dispose() { } });

	protected readonly _store = new DisposableStore();

	constructor() {
		trackDisposable(this);
		setParentOfDisposable(this._store, this);
	}

	public dispose(): void {
		markAsDisposed(this);

		this._store.dispose();
	}

	/**
	 * Adds `o` to the collection of disposables managed by this object.
	 */
	protected _register<T extends IDisposable>(o: T): T {
		if ((o as unknown as Disposable) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}
		return this._store.add(o);
	}
}

/**
 * Manages the lifecycle of a disposable value that may be changed.
 *
 * This ensures that when the disposable value is changed, the previously held disposable is disposed of. You can
 * also register a `MutableDisposable` on a `Disposable` to ensure it is automatically cleaned up.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
	private _value?: T;
	private _isDisposed = false;

	constructor() {
		trackDisposable(this);
	}

	get value(): T | undefined {
		return this._isDisposed ? undefined : this._value;
	}

	set value(value: T | undefined) {
		if (this._isDisposed || value === this._value) {
			return;
		}

		this._value?.dispose();
		if (value) {
			setParentOfDisposable(value, this);
		}
		this._value = value;
	}

	/**
	 * Resets the stored value and disposed of the previously stored value.
	 */
	clear(): void {
		this.value = undefined;
	}

	dispose(): void {
		this._isDisposed = true;
		markAsDisposed(this);
		this._value?.dispose();
		this._value = undefined;
	}

	/**
	 * Clears the value, but does not dispose it.
	 * The old value is returned.
	*/
	clearAndLeak(): T | undefined {
		const oldValue = this._value;
		this._value = undefined;
		if (oldValue) {
			setParentOfDisposable(oldValue, null);
		}
		return oldValue;
	}
}

export class RefCountedDisposable {

	private _counter: number = 1;

	constructor(
		private readonly _disposable: IDisposable,
	) { }

	acquire() {
		this._counter++;
		return this;
	}

	release() {
		if (--this._counter === 0) {
			this._disposable.dispose();
		}
		return this;
	}
}

/**
 * A safe disposable can be `unset` so that a leaked reference (listener)
 * can be cut-off.
 */
export class SafeDisposable implements IDisposable {

	dispose: () => void = () => { };
	unset: () => void = () => { };
	isset: () => boolean = () => false;

	constructor() {
		trackDisposable(this);
	}

	set(fn: Function) {
		let callback: Function | undefined = fn;
		this.unset = () => callback = undefined;
		this.isset = () => callback !== undefined;
		this.dispose = () => {
			if (callback) {
				callback();
				callback = undefined;
				markAsDisposed(this);
			}
		};
		return this;
	}
}

export interface IReference<T> extends IDisposable {
	readonly object: T;
}

export abstract class ReferenceCollection<T> {

	private readonly references: Map<string, { readonly object: T; counter: number }> = new Map();

	acquire(key: string, ...args: any[]): IReference<T> {
		let reference = this.references.get(key);

		if (!reference) {
			reference = { counter: 0, object: this.createReferencedObject(key, ...args) };
			this.references.set(key, reference);
		}

		const { object } = reference;
		const dispose = once(() => {
			if (--reference!.counter === 0) {
				this.destroyReferencedObject(key, reference!.object);
				this.references.delete(key);
			}
		});

		reference.counter++;

		return { object, dispose };
	}

	protected abstract createReferencedObject(key: string, ...args: any[]): T;
	protected abstract destroyReferencedObject(key: string, object: T): void;
}

/**
 * Unwraps a reference collection of promised values. Makes sure
 * references are disposed whenever promises get rejected.
 */
export class AsyncReferenceCollection<T> {

	constructor(private referenceCollection: ReferenceCollection<Promise<T>>) { }

	async acquire(key: string, ...args: any[]): Promise<IReference<T>> {
		const ref = this.referenceCollection.acquire(key, ...args);

		try {
			const object = await ref.object;

			return {
				object,
				dispose: () => ref.dispose()
			};
		} catch (error) {
			ref.dispose();
			throw error;
		}
	}
}

export class ImmortalReference<T> implements IReference<T> {
	constructor(public object: T) { }
	dispose(): void { /* noop */ }
}

export function disposeOnReturn(fn: (store: DisposableStore) => void): void {
	const store = new DisposableStore();
	try {
		fn(store);
	} finally {
		store.dispose();
	}
}

/**
 * A map the manages the lifecycle of the values that it stores.
 */
export class DisposableMap<K, V extends IDisposable = IDisposable> implements IDisposable {

	private readonly _store = new Map<K, V>();
	private _isDisposed = false;

	constructor() {
		trackDisposable(this);
	}

	/**
	 * Disposes of all stored values and mark this object as disposed.
	 *
	 * Trying to use this object after it has been disposed of is an error.
	 */
	dispose(): void {
		markAsDisposed(this);
		this._isDisposed = true;
		this.clearAndDisposeAll();
	}

	/**
	 * Disposes of all stored values and clear the map, but DO NOT mark this object as disposed.
	 */
	clearAndDisposeAll(): void {
		if (!this._store.size) {
			return;
		}

		try {
			dispose(this._store.values());
		} finally {
			this._store.clear();
		}
	}

	has(key: K): boolean {
		return this._store.has(key);
	}

	get(key: K): V | undefined {
		return this._store.get(key);
	}

	set(key: K, value: V, skipDisposeOnOverwrite = false): void {
		if (this._isDisposed) {
			console.warn(new Error('Trying to add a disposable to a DisposableMap that has already been disposed of. The added object will be leaked!').stack);
		}

		if (!skipDisposeOnOverwrite) {
			this._store.get(key)?.dispose();
		}

		this._store.set(key, value);
	}

	/**
	 * Delete the value stored for `key` from this map and also dispose of it.
	 */
	deleteAndDispose(key: K): void {
		this._store.get(key)?.dispose();
		this._store.delete(key);
	}

	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this._store[Symbol.iterator]();
	}
}
