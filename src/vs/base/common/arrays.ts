/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { CancellationError } from 'vs/base/common/errors';
import { ISplice } from 'vs/base/common/sequence';

/**
 * Returns the last element of an array.
 * @param array The array.
 * @param n Which element from the end (default is zero).
 */
export function tail<T>(array: ArrayLike<T>, n: number = 0): T {
	return array[array.length - (1 + n)];
}

export function tail2<T>(arr: T[]): [T[], T] {
	if (arr.length === 0) {
		throw new Error('Invalid tail call');
	}

	return [arr.slice(0, arr.length - 1), arr[arr.length - 1]];
}

export function equals<T>(one: ReadonlyArray<T> | undefined, other: ReadonlyArray<T> | undefined, itemEquals: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
	if (one === other) {
		return true;
	}

	if (!one || !other) {
		return false;
	}

	if (one.length !== other.length) {
		return false;
	}

	for (let i = 0, len = one.length; i < len; i++) {
		if (!itemEquals(one[i], other[i])) {
			return false;
		}
	}

	return true;
}

/**
 * Remove the element at `index` by replacing it with the last element. This is faster than `splice`
 * but changes the order of the array
 */
export function removeFastWithoutKeepingOrder<T>(array: T[], index: number) {
	const last = array.length - 1;
	if (index < last) {
		array[index] = array[last];
	}
	array.pop();
}

/**
 * Performs a binary search algorithm over a sorted array.
 *
 * @param array The array being searched.
 * @param key The value we search for.
 * @param comparator A function that takes two array elements and returns zero
 *   if they are equal, a negative number if the first element precedes the
 *   second one in the sorting order, or a positive number if the second element
 *   precedes the first one.
 * @return See {@link binarySearch2}
 */
export function binarySearch<T>(array: ReadonlyArray<T>, key: T, comparator: (op1: T, op2: T) => number): number {
	return binarySearch2(array.length, i => comparator(array[i], key));
}

/**
 * Performs a binary search algorithm over a sorted collection. Useful for cases
 * when we need to perform a binary search over something that isn't actually an
 * array, and converting data to an array would defeat the use of binary search
 * in the first place.
 *
 * @param length The collection length.
 * @param compareToKey A function that takes an index of an element in the
 *   collection and returns zero if the value at this index is equal to the
 *   search key, a negative number if the value precedes the search key in the
 *   sorting order, or a positive number if the search key precedes the value.
 * @return A non-negative index of an element, if found. If not found, the
 *   result is -(n+1) (or ~n, using bitwise notation), where n is the index
 *   where the key should be inserted to maintain the sorting order.
 */
export function binarySearch2(length: number, compareToKey: (index: number) => number): number {
	let low = 0,
		high = length - 1;

	while (low <= high) {
		const mid = ((low + high) / 2) | 0;
		const comp = compareToKey(mid);
		if (comp < 0) {
			low = mid + 1;
		} else if (comp > 0) {
			high = mid - 1;
		} else {
			return mid;
		}
	}
	return -(low + 1);
}

/**
 * Takes a sorted array and a function p. The array is sorted in such a way that all elements where p(x) is false
 * are located before all elements where p(x) is true.
 * @returns the least x for which p(x) is true or array.length if no element fullfills the given function.
 */
export function findFirstInSorted<T>(array: ReadonlyArray<T>, p: (x: T) => boolean): number {
	let low = 0, high = array.length;
	if (high === 0) {
		return 0; // no children
	}
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (p(array[mid])) {
			high = mid;
		} else {
			low = mid + 1;
		}
	}
	return low;
}

type Compare<T> = (a: T, b: T) => number;


export function quickSelect<T>(nth: number, data: T[], compare: Compare<T>): T {

	nth = nth | 0;

	if (nth >= data.length) {
		throw new TypeError('invalid index');
	}

	const pivotValue = data[Math.floor(data.length * Math.random())];
	const lower: T[] = [];
	const higher: T[] = [];
	const pivots: T[] = [];

	for (const value of data) {
		const val = compare(value, pivotValue);
		if (val < 0) {
			lower.push(value);
		} else if (val > 0) {
			higher.push(value);
		} else {
			pivots.push(value);
		}
	}

	if (nth < lower.length) {
		return quickSelect(nth, lower, compare);
	} else if (nth < lower.length + pivots.length) {
		return pivots[0];
	} else {
		return quickSelect(nth - (lower.length + pivots.length), higher, compare);
	}
}

export function groupBy<T>(data: ReadonlyArray<T>, compare: (a: T, b: T) => number): T[][] {
	const result: T[][] = [];
	let currentGroup: T[] | undefined = undefined;
	for (const element of data.slice(0).sort(compare)) {
		if (!currentGroup || compare(currentGroup[0], element) !== 0) {
			currentGroup = [element];
			result.push(currentGroup);
		} else {
			currentGroup.push(element);
		}
	}
	return result;
}

interface IMutableSplice<T> extends ISplice<T> {
	readonly toInsert: T[];
	deleteCount: number;
}

/**
 * Diffs two *sorted* arrays and computes the splices which apply the diff.
 */
export function sortedDiff<T>(before: ReadonlyArray<T>, after: ReadonlyArray<T>, compare: (a: T, b: T) => number): ISplice<T>[] {
	const result: IMutableSplice<T>[] = [];

	function pushSplice(start: number, deleteCount: number, toInsert: T[]): void {
		if (deleteCount === 0 && toInsert.length === 0) {
			return;
		}

		const latest = result[result.length - 1];

		if (latest && latest.start + latest.deleteCount === start) {
			latest.deleteCount += deleteCount;
			latest.toInsert.push(...toInsert);
		} else {
			result.push({ start, deleteCount, toInsert });
		}
	}

	let beforeIdx = 0;
	let afterIdx = 0;

	while (true) {
		if (beforeIdx === before.length) {
			pushSplice(beforeIdx, 0, after.slice(afterIdx));
			break;
		}
		if (afterIdx === after.length) {
			pushSplice(beforeIdx, before.length - beforeIdx, []);
			break;
		}

		const beforeElement = before[beforeIdx];
		const afterElement = after[afterIdx];
		const n = compare(beforeElement, afterElement);
		if (n === 0) {
			// equal
			beforeIdx += 1;
			afterIdx += 1;
		} else if (n < 0) {
			// beforeElement is smaller -> before element removed
			pushSplice(beforeIdx, 1, []);
			beforeIdx += 1;
		} else if (n > 0) {
			// beforeElement is greater -> after element added
			pushSplice(beforeIdx, 0, [afterElement]);
			afterIdx += 1;
		}
	}

	return result;
}

/**
 * Takes two *sorted* arrays and computes their delta (removed, added elements).
 * Finishes in `Math.min(before.length, after.length)` steps.
 */
export function delta<T>(before: ReadonlyArray<T>, after: ReadonlyArray<T>, compare: (a: T, b: T) => number): { removed: T[]; added: T[] } {
	const splices = sortedDiff(before, after, compare);
	const removed: T[] = [];
	const added: T[] = [];

	for (const splice of splices) {
		removed.push(...before.slice(splice.start, splice.start + splice.deleteCount));
		added.push(...splice.toInsert);
	}

	return { removed, added };
}

/**
 * Returns the top N elements from the array.
 *
 * Faster than sorting the entire array when the array is a lot larger than N.
 *
 * @param array The unsorted array.
 * @param compare A sort function for the elements.
 * @param n The number of elements to return.
 * @return The first n elements from array when sorted with compare.
 */
export function top<T>(array: ReadonlyArray<T>, compare: (a: T, b: T) => number, n: number): T[] {
	if (n === 0) {
		return [];
	}
	const result = array.slice(0, n).sort(compare);
	topStep(array, compare, result, n, array.length);
	return result;
}

/**
 * Asynchronous variant of `top()` allowing for splitting up work in batches between which the event loop can run.
 *
 * Returns the top N elements from the array.
 *
 * Faster than sorting the entire array when the array is a lot larger than N.
 *
 * @param array The unsorted array.
 * @param compare A sort function for the elements.
 * @param n The number of elements to return.
 * @param batch The number of elements to examine before yielding to the event loop.
 * @return The first n elements from array when sorted with compare.
 */
export function topAsync<T>(array: T[], compare: (a: T, b: T) => number, n: number, batch: number, token?: CancellationToken): Promise<T[]> {
	if (n === 0) {
		return Promise.resolve([]);
	}

	return new Promise((resolve, reject) => {
		(async () => {
			const o = array.length;
			const result = array.slice(0, n).sort(compare);
			for (let i = n, m = Math.min(n + batch, o); i < o; i = m, m = Math.min(m + batch, o)) {
				if (i > n) {
					await new Promise(resolve => setTimeout(resolve)); // any other delay function would starve I/O
				}
				if (token && token.isCancellationRequested) {
					throw new CancellationError();
				}
				topStep(array, compare, result, i, m);
			}
			return result;
		})()
			.then(resolve, reject);
	});
}

function topStep<T>(array: ReadonlyArray<T>, compare: (a: T, b: T) => number, result: T[], i: number, m: number): void {
	for (const n = result.length; i < m; i++) {
		const element = array[i];
		if (compare(element, result[n - 1]) < 0) {
			result.pop();
			const j = findFirstInSorted(result, e => compare(element, e) < 0);
			result.splice(j, 0, element);
		}
	}
}

/**
 * @returns New array with all falsy values removed. The original array IS NOT modified.
 */
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
	return <T[]>array.filter(e => !!e);
}

/**
 * Remove all falsy values from `array`. The original array IS modified.
 */
export function coalesceInPlace<T>(array: Array<T | undefined | null>): void {
	let to = 0;
	for (let i = 0; i < array.length; i++) {
		if (!!array[i]) {
			array[to] = array[i];
			to += 1;
		}
	}
	array.length = to;
}

/**
 * @deprecated Use `Array.copyWithin` instead
 */
export function move(array: any[], from: number, to: number): void {
	array.splice(to, 0, array.splice(from, 1)[0]);
}

/**
 * @returns false if the provided object is an array and not empty.
 */
export function isFalsyOrEmpty(obj: any): boolean {
	return !Array.isArray(obj) || obj.length === 0;
}

/**
 * @returns True if the provided object is an array and has at least one element.
 */
export function isNonEmptyArray<T>(obj: T[] | undefined | null): obj is T[];
export function isNonEmptyArray<T>(obj: readonly T[] | undefined | null): obj is readonly T[];
export function isNonEmptyArray<T>(obj: T[] | readonly T[] | undefined | null): obj is T[] | readonly T[] {
	return Array.isArray(obj) && obj.length > 0;
}

/**
 * Removes duplicates from the given array. The optional keyFn allows to specify
 * how elements are checked for equality by returning an alternate value for each.
 */
export function distinct<T>(array: ReadonlyArray<T>, keyFn: (value: T) => any = value => value): T[] {
	const seen = new Set<any>();

	return array.filter(element => {
		const key = keyFn!(element);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function uniqueFilter<T, R>(keyFn: (t: T) => R): (t: T) => boolean {
	const seen = new Set<R>();

	return element => {
		const key = keyFn(element);

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	};
}

export function findLast<T>(arr: readonly T[], predicate: (item: T) => boolean): T | undefined {
	const idx = findLastIndex(arr, predicate);
	if (idx === -1) {
		return undefined;
	}
	return arr[idx];
}

export function findLastIndex<T>(array: ReadonlyArray<T>, fn: (item: T) => boolean): number {
	for (let i = array.length - 1; i >= 0; i--) {
		const element = array[i];

		if (fn(element)) {
			return i;
		}
	}

	return -1;
}

export function firstOrDefault<T, NotFound = T>(array: ReadonlyArray<T>, notFoundValue: NotFound): T | NotFound;
export function firstOrDefault<T>(array: ReadonlyArray<T>): T | undefined;
export function firstOrDefault<T, NotFound = T>(array: ReadonlyArray<T>, notFoundValue?: NotFound): T | NotFound | undefined {
	return array.length > 0 ? array[0] : notFoundValue;
}

export function lastOrDefault<T, NotFound = T>(array: ReadonlyArray<T>, notFoundValue: NotFound): T | NotFound;
export function lastOrDefault<T>(array: ReadonlyArray<T>): T | undefined;
export function lastOrDefault<T, NotFound = T>(array: ReadonlyArray<T>, notFoundValue?: NotFound): T | NotFound | undefined {
	return array.length > 0 ? array[array.length - 1] : notFoundValue;
}

export function commonPrefixLength<T>(one: ReadonlyArray<T>, other: ReadonlyArray<T>, equals: (a: T, b: T) => boolean = (a, b) => a === b): number {
	let result = 0;

	for (let i = 0, len = Math.min(one.length, other.length); i < len && equals(one[i], other[i]); i++) {
		result++;
	}

	return result;
}

/**
 * @deprecated Use `[].flat()`
 */
export function flatten<T>(arr: T[][]): T[] {
	return (<T[]>[]).concat(...arr);
}

export function range(to: number): number[];
export function range(from: number, to: number): number[];
export function range(arg: number, to?: number): number[] {
	let from = typeof to === 'number' ? arg : 0;

	if (typeof to === 'number') {
		from = arg;
	} else {
		from = 0;
		to = arg;
	}

	const result: number[] = [];

	if (from <= to) {
		for (let i = from; i < to; i++) {
			result.push(i);
		}
	} else {
		for (let i = from; i > to; i--) {
			result.push(i);
		}
	}

	return result;
}

export function index<T>(array: ReadonlyArray<T>, indexer: (t: T) => string): { [key: string]: T };
export function index<T, R>(array: ReadonlyArray<T>, indexer: (t: T) => string, mapper: (t: T) => R): { [key: string]: R };
export function index<T, R>(array: ReadonlyArray<T>, indexer: (t: T) => string, mapper?: (t: T) => R): { [key: string]: R } {
	return array.reduce((r, t) => {
		r[indexer(t)] = mapper ? mapper(t) : t;
		return r;
	}, Object.create(null));
}

/**
 * Inserts an element into an array. Returns a function which, when
 * called, will remove that element from the array.
 *
 * @deprecated In almost all cases, use a `Set<T>` instead.
 */
export function insert<T>(array: T[], element: T): () => void {
	array.push(element);

	return () => remove(array, element);
}

/**
 * Removes an element from an array if it can be found.
 *
 * @deprecated In almost all cases, use a `Set<T>` instead.
 */
export function remove<T>(array: T[], element: T): T | undefined {
	const index = array.indexOf(element);
	if (index > -1) {
		array.splice(index, 1);

		return element;
	}

	return undefined;
}

/**
 * Insert `insertArr` inside `target` at `insertIndex`.
 * Please don't touch unless you understand https://jsperf.com/inserting-an-array-within-an-array
 */
export function arrayInsert<T>(target: T[], insertIndex: number, insertArr: T[]): T[] {
	const before = target.slice(0, insertIndex);
	const after = target.slice(insertIndex);
	return before.concat(insertArr, after);
}

/**
 * Uses Fisher-Yates shuffle to shuffle the given array
 */
export function shuffle<T>(array: T[], _seed?: number): void {
	let rand: () => number;

	if (typeof _seed === 'number') {
		let seed = _seed;
		// Seeded random number generator in JS. Modified from:
		// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
		rand = () => {
			const x = Math.sin(seed++) * 179426549; // throw away most significant digits and reduce any potential bias
			return x - Math.floor(x);
		};
	} else {
		rand = Math.random;
	}

	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

/**
 * Pushes an element to the start of the array, if found.
 */
export function pushToStart<T>(arr: T[], value: T): void {
	const index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
		arr.unshift(value);
	}
}

/**
 * Pushes an element to the end of the array, if found.
 */
export function pushToEnd<T>(arr: T[], value: T): void {
	const index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
		arr.push(value);
	}
}

export function pushMany<T>(arr: T[], items: ReadonlyArray<T>): void {
	for (const item of items) {
		arr.push(item);
	}
}

export function mapArrayOrNot<T, U>(items: T | T[], fn: (_: T) => U): U | U[] {
	return Array.isArray(items) ?
		items.map(fn) :
		fn(items);
}

export function asArray<T>(x: T | T[]): T[];
export function asArray<T>(x: T | readonly T[]): readonly T[];
export function asArray<T>(x: T | T[]): T[] {
	return Array.isArray(x) ? x : [x];
}

export function getRandomElement<T>(arr: T[]): T | undefined {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns the first mapped value of the array which is not undefined.
 */
export function mapFind<T, R>(array: Iterable<T>, mapFn: (value: T) => R | undefined): R | undefined {
	for (const value of array) {
		const mapped = mapFn(value);
		if (mapped !== undefined) {
			return mapped;
		}
	}

	return undefined;
}

/**
 * Insert the new items in the array.
 * @param array The original array.
 * @param start The zero-based location in the array from which to start inserting elements.
 * @param newItems The items to be inserted
 */
export function insertInto<T>(array: T[], start: number, newItems: T[]): void {
	const startIdx = getActualStartIndex(array, start);
	const originalLength = array.length;
	const newItemsLength = newItems.length;
	array.length = originalLength + newItemsLength;
	// Move the items after the start index, start from the end so that we don't overwrite any value.
	for (let i = originalLength - 1; i >= startIdx; i--) {
		array[i + newItemsLength] = array[i];
	}

	for (let i = 0; i < newItemsLength; i++) {
		array[i + startIdx] = newItems[i];
	}
}

/**
 * Removes elements from an array and inserts new elements in their place, returning the deleted elements. Alternative to the native Array.splice method, it
 * can only support limited number of items due to the maximum call stack size limit.
 * @param array The original array.
 * @param start The zero-based location in the array from which to start removing elements.
 * @param deleteCount The number of elements to remove.
 * @returns An array containing the elements that were deleted.
 */
export function splice<T>(array: T[], start: number, deleteCount: number, newItems: T[]): T[] {
	const index = getActualStartIndex(array, start);
	const result = array.splice(index, deleteCount);
	insertInto(array, index, newItems);
	return result;
}

/**
 * Determine the actual start index (same logic as the native splice() or slice())
 * If greater than the length of the array, start will be set to the length of the array. In this case, no element will be deleted but the method will behave as an adding function, adding as many element as item[n*] provided.
 * If negative, it will begin that many elements from the end of the array. (In this case, the origin -1, meaning -n is the index of the nth last element, and is therefore equivalent to the index of array.length - n.) If array.length + start is less than 0, it will begin from index 0.
 * @param array The target array.
 * @param start The operation index.
 */
function getActualStartIndex<T>(array: T[], start: number): number {
	return start < 0 ? Math.max(start + array.length, 0) : Math.min(start, array.length);
}

/**
 * When comparing two values,
 * a negative number indicates that the first value is less than the second,
 * a positive number indicates that the first value is greater than the second,
 * and zero indicates that neither is the case.
*/
export type CompareResult = number;

export namespace CompareResult {
	export function isLessThan(result: CompareResult): boolean {
		return result < 0;
	}

	export function isLessThanOrEqual(result: CompareResult): boolean {
		return result <= 0;
	}

	export function isGreaterThan(result: CompareResult): boolean {
		return result > 0;
	}

	export function isNeitherLessOrGreaterThan(result: CompareResult): boolean {
		return result === 0;
	}

	export const greaterThan = 1;
	export const lessThan = -1;
	export const neitherLessOrGreaterThan = 0;
}

/**
 * A comparator `c` defines a total order `<=` on `T` as following:
 * `c(a, b) <= 0` iff `a` <= `b`.
 * We also have `c(a, b) == 0` iff `c(b, a) == 0`.
*/
export type Comparator<T> = (a: T, b: T) => CompareResult;

export function compareBy<TItem, TCompareBy>(selector: (item: TItem) => TCompareBy, comparator: Comparator<TCompareBy>): Comparator<TItem> {
	return (a, b) => comparator(selector(a), selector(b));
}

export function tieBreakComparators<TItem>(...comparators: Comparator<TItem>[]): Comparator<TItem> {
	return (item1, item2) => {
		for (const comparator of comparators) {
			const result = comparator(item1, item2);
			if (!CompareResult.isNeitherLessOrGreaterThan(result)) {
				return result;
			}
		}
		return CompareResult.neitherLessOrGreaterThan;
	};
}

/**
 * The natural order on numbers.
*/
export const numberComparator: Comparator<number> = (a, b) => a - b;

export const booleanComparator: Comparator<boolean> = (a, b) => numberComparator(a ? 1 : 0, b ? 1 : 0);

export function reverseOrder<TItem>(comparator: Comparator<TItem>): Comparator<TItem> {
	return (a, b) => -comparator(a, b);
}

/**
 * Returns the first item that is equal to or greater than every other item.
*/
export function findMaxBy<T>(items: readonly T[], comparator: Comparator<T>): T | undefined {
	if (items.length === 0) {
		return undefined;
	}

	let max = items[0];
	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		if (comparator(item, max) > 0) {
			max = item;
		}
	}
	return max;
}

/**
 * Returns the last item that is equal to or greater than every other item.
*/
export function findLastMaxBy<T>(items: readonly T[], comparator: Comparator<T>): T | undefined {
	if (items.length === 0) {
		return undefined;
	}

	let max = items[0];
	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		if (comparator(item, max) >= 0) {
			max = item;
		}
	}
	return max;
}

/**
 * Returns the first item that is equal to or less than every other item.
*/
export function findMinBy<T>(items: readonly T[], comparator: Comparator<T>): T | undefined {
	return findMaxBy(items, (a, b) => -comparator(a, b));
}

export function findMaxIdxBy<T>(items: readonly T[], comparator: Comparator<T>): number {
	if (items.length === 0) {
		return -1;
	}

	let maxIdx = 0;
	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		if (comparator(item, items[maxIdx]) > 0) {
			maxIdx = i;
		}
	}
	return maxIdx;
}

export class ArrayQueue<T> {
	private firstIdx = 0;
	private lastIdx = this.items.length - 1;

	/**
	 * Constructs a queue that is backed by the given array. Runtime is O(1).
	*/
	constructor(private readonly items: readonly T[]) { }

	get length(): number {
		return this.lastIdx - this.firstIdx + 1;
	}

	/**
	 * Consumes elements from the beginning of the queue as long as the predicate returns true.
	 * If no elements were consumed, `null` is returned. Has a runtime of O(result.length).
	*/
	takeWhile(predicate: (value: T) => boolean): T[] | null {
		// P(k) := k <= this.lastIdx && predicate(this.items[k])
		// Find s := min { k | k >= this.firstIdx && !P(k) } and return this.data[this.firstIdx...s)

		let startIdx = this.firstIdx;
		while (startIdx < this.items.length && predicate(this.items[startIdx])) {
			startIdx++;
		}
		const result = startIdx === this.firstIdx ? null : this.items.slice(this.firstIdx, startIdx);
		this.firstIdx = startIdx;
		return result;
	}

	/**
	 * Consumes elements from the end of the queue as long as the predicate returns true.
	 * If no elements were consumed, `null` is returned.
	 * The result has the same order as the underlying array!
	*/
	takeFromEndWhile(predicate: (value: T) => boolean): T[] | null {
		// P(k) := this.firstIdx >= k && predicate(this.items[k])
		// Find s := max { k | k <= this.lastIdx && !P(k) } and return this.data(s...this.lastIdx]

		let endIdx = this.lastIdx;
		while (endIdx >= 0 && predicate(this.items[endIdx])) {
			endIdx--;
		}
		const result = endIdx === this.lastIdx ? null : this.items.slice(endIdx + 1, this.lastIdx + 1);
		this.lastIdx = endIdx;
		return result;
	}

	peek(): T | undefined {
		if (this.length === 0) {
			return undefined;
		}
		return this.items[this.firstIdx];
	}

	peekLast(): T | undefined {
		if (this.length === 0) {
			return undefined;
		}
		return this.items[this.lastIdx];
	}

	dequeue(): T | undefined {
		const result = this.items[this.firstIdx];
		this.firstIdx++;
		return result;
	}

	removeLast(): T | undefined {
		const result = this.items[this.lastIdx];
		this.lastIdx--;
		return result;
	}

	takeCount(count: number): T[] {
		const result = this.items.slice(this.firstIdx, this.firstIdx + count);
		this.firstIdx += count;
		return result;
	}
}

/**
 * This class is faster than an iterator and array for lazy computed data.
*/
export class CallbackIterable<T> {
	public static readonly empty = new CallbackIterable<never>(_callback => { });

	constructor(
		/**
		 * Calls the callback for every item.
		 * Stops when the callback returns false.
		*/
		public readonly iterate: (callback: (item: T) => boolean) => void
	) {
	}

	forEach(handler: (item: T) => void) {
		this.iterate(item => { handler(item); return true; });
	}

	toArray(): T[] {
		const result: T[] = [];
		this.iterate(item => { result.push(item); return true; });
		return result;
	}

	filter(predicate: (item: T) => boolean): CallbackIterable<T> {
		return new CallbackIterable(cb => this.iterate(item => predicate(item) ? cb(item) : true));
	}

	map<TResult>(mapFn: (item: T) => TResult): CallbackIterable<TResult> {
		return new CallbackIterable<TResult>(cb => this.iterate(item => cb(mapFn(item))));
	}

	some(predicate: (item: T) => boolean): boolean {
		let result = false;
		this.iterate(item => { result = predicate(item); return !result; });
		return result;
	}

	findFirst(predicate: (item: T) => boolean): T | undefined {
		let result: T | undefined;
		this.iterate(item => {
			if (predicate(item)) {
				result = item;
				return false;
			}
			return true;
		});
		return result;
	}

	findLast(predicate: (item: T) => boolean): T | undefined {
		let result: T | undefined;
		this.iterate(item => {
			if (predicate(item)) {
				result = item;
			}
			return true;
		});
		return result;
	}

	findLastMaxBy(comparator: Comparator<T>): T | undefined {
		let result: T | undefined;
		let first = true;
		this.iterate(item => {
			if (first || CompareResult.isGreaterThan(comparator(item, result!))) {
				first = false;
				result = item;
			}
			return true;
		});
		return result;
	}
}
