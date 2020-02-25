/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotification, INotificationHandle, INotificationActions, INotificationProgress, NoOpNotification, Severity, NotificationMessage, IPromptChoice, IStatusMessageOptions, NotificationsFilter } from 'vs/platform/notification/common/notification';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import { Action } from 'vs/base/common/actions';
import { isErrorWithActions } from 'vs/base/common/errorsWithActions';
import { find, equals } from 'vs/base/common/arrays';
import { parseLinkedText, LinkedText } from 'vs/base/common/linkedText';

export interface INotificationsModel {

	//#region Notifications as Toasts/Center

	readonly notifications: INotificationViewItem[];

	readonly onDidChangeNotification: Event<INotificationChangeEvent>;
	readonly onDidChangeFilter: Event<NotificationsFilter>;

	addNotification(notification: INotification): INotificationHandle;

	setFilter(filter: NotificationsFilter): void;

	//#endregion


	//#region  Notifications as Status

	readonly statusMessage: IStatusMessageViewItem | undefined;

	readonly onDidChangeStatusMessage: Event<IStatusMessageChangeEvent>;

	showStatusMessage(message: NotificationMessage, options?: IStatusMessageOptions): IDisposable;

	//#endregion
}

export const enum NotificationChangeType {
	ADD,
	CHANGE,
	REMOVE
}

export interface INotificationChangeEvent {

	/**
	 * The index this notification has in the list of notifications.
	 */
	index: number;

	/**
	 * The notification this change is about.
	 */
	item: INotificationViewItem;

	/**
	 * The kind of notification change.
	 */
	kind: NotificationChangeType;
}

export const enum StatusMessageChangeType {
	ADD,
	REMOVE
}

export interface IStatusMessageViewItem {
	message: string;
	options?: IStatusMessageOptions;
}

export interface IStatusMessageChangeEvent {

	/**
	 * The status message item this change is about.
	 */
	item: IStatusMessageViewItem;

	/**
	 * The kind of status message change.
	 */
	kind: StatusMessageChangeType;
}

export class NotificationHandle extends Disposable implements INotificationHandle {

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	constructor(private readonly item: INotificationViewItem, private readonly onClose: (item: INotificationViewItem) => void) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		Event.once(this.item.onDidClose)(() => {
			this._onDidClose.fire();

			this.dispose();
		});
	}

	get progress(): INotificationProgress {
		return this.item.progress;
	}

	updateSeverity(severity: Severity): void {
		this.item.updateSeverity(severity);
	}

	updateMessage(message: NotificationMessage): void {
		this.item.updateMessage(message);
	}

	updateActions(actions?: INotificationActions): void {
		this.item.updateActions(actions);
	}

	close(): void {
		this.onClose(this.item);

		this.dispose();
	}
}

export class NotificationsModel extends Disposable implements INotificationsModel {

	private static readonly NO_OP_NOTIFICATION = new NoOpNotification();

	private readonly _onDidChangeNotification = this._register(new Emitter<INotificationChangeEvent>());
	readonly onDidChangeNotification = this._onDidChangeNotification.event;

	private readonly _onDidChangeStatusMessage = this._register(new Emitter<IStatusMessageChangeEvent>());
	readonly onDidChangeStatusMessage = this._onDidChangeStatusMessage.event;

	private readonly _onDidChangeFilter = this._register(new Emitter<NotificationsFilter>());
	readonly onDidChangeFilter = this._onDidChangeFilter.event;

	private readonly _notifications: INotificationViewItem[] = [];
	get notifications(): INotificationViewItem[] { return this._notifications; }

	private _statusMessage: IStatusMessageViewItem | undefined;
	get statusMessage(): IStatusMessageViewItem | undefined { return this._statusMessage; }

	private filter = NotificationsFilter.OFF;

	setFilter(filter: NotificationsFilter): void {
		this.filter = filter;

		this._onDidChangeFilter.fire(filter);
	}

	addNotification(notification: INotification): INotificationHandle {
		const item = this.createViewItem(notification);
		if (!item) {
			return NotificationsModel.NO_OP_NOTIFICATION; // return early if this is a no-op
		}

		// Deduplicate
		const duplicate = this.findNotification(item);
		if (duplicate) {
			duplicate.close();
		}

		// Add to list as first entry
		this._notifications.splice(0, 0, item);

		// Events
		this._onDidChangeNotification.fire({ item, index: 0, kind: NotificationChangeType.ADD });

		// Wrap into handle
		return new NotificationHandle(item, item => this.onClose(item));
	}

	private onClose(item: INotificationViewItem): void {
		const liveItem = this.findNotification(item);
		if (liveItem && liveItem !== item) {
			liveItem.close(); // item could have been replaced with another one, make sure to close the live item
		} else {
			item.close(); // otherwise just close the item that was passed in
		}
	}

	private findNotification(item: INotificationViewItem): INotificationViewItem | undefined {
		return find(this._notifications, notification => notification.equals(item));
	}

	private createViewItem(notification: INotification): INotificationViewItem | undefined {
		const item = NotificationViewItem.create(notification, this.filter);
		if (!item) {
			return undefined;
		}

		// Item Events
		const onItemChangeEvent = () => {
			const index = this._notifications.indexOf(item);
			if (index >= 0) {
				this._onDidChangeNotification.fire({ item, index, kind: NotificationChangeType.CHANGE });
			}
		};

		const itemExpansionChangeListener = item.onDidChangeExpansion(() => onItemChangeEvent());

		const itemLabelChangeListener = item.onDidChangeLabel(e => {
			// a label change in the area of actions or the message is a change that potentially has an impact
			// on the size of the notification and as such we emit a change event so that viewers can redraw
			if (e.kind === NotificationViewItemLabelKind.ACTIONS || e.kind === NotificationViewItemLabelKind.MESSAGE) {
				onItemChangeEvent();
			}
		});

		Event.once(item.onDidClose)(() => {
			itemExpansionChangeListener.dispose();
			itemLabelChangeListener.dispose();

			const index = this._notifications.indexOf(item);
			if (index >= 0) {
				this._notifications.splice(index, 1);
				this._onDidChangeNotification.fire({ item, index, kind: NotificationChangeType.REMOVE });
			}
		});

		return item;
	}

	showStatusMessage(message: NotificationMessage, options?: IStatusMessageOptions): IDisposable {
		const item = StatusMessageViewItem.create(message, options);
		if (!item) {
			return Disposable.None;
		}

		// Remember as current status message and fire events
		this._statusMessage = item;
		this._onDidChangeStatusMessage.fire({ kind: StatusMessageChangeType.ADD, item });

		return toDisposable(() => {

			// Only reset status message if the item is still the one we had remembered
			if (this._statusMessage === item) {
				this._statusMessage = undefined;
				this._onDidChangeStatusMessage.fire({ kind: StatusMessageChangeType.REMOVE, item });
			}
		});
	}
}

export interface INotificationViewItem {
	readonly severity: Severity;
	readonly sticky: boolean;
	readonly silent: boolean;
	readonly message: INotificationMessage;
	readonly source: string | undefined;
	readonly actions: INotificationActions | undefined;
	readonly progress: INotificationViewItemProgress;

	readonly expanded: boolean;
	readonly canCollapse: boolean;
	readonly hasProgress: boolean;

	readonly onDidChangeExpansion: Event<void>;
	readonly onDidClose: Event<void>;
	readonly onDidChangeLabel: Event<INotificationViewItemLabelChangeEvent>;

	expand(): void;
	collapse(skipEvents?: boolean): void;
	toggle(): void;

	updateSeverity(severity: Severity): void;
	updateMessage(message: NotificationMessage): void;
	updateActions(actions?: INotificationActions): void;

	close(): void;

	equals(item: INotificationViewItem): boolean;
}

export function isNotificationViewItem(obj: unknown): obj is INotificationViewItem {
	return obj instanceof NotificationViewItem;
}

export const enum NotificationViewItemLabelKind {
	SEVERITY,
	MESSAGE,
	ACTIONS,
	PROGRESS
}

export interface INotificationViewItemLabelChangeEvent {
	kind: NotificationViewItemLabelKind;
}

export interface INotificationViewItemProgressState {
	infinite?: boolean;
	total?: number;
	worked?: number;
	done?: boolean;
}

export interface INotificationViewItemProgress extends INotificationProgress {
	readonly state: INotificationViewItemProgressState;

	dispose(): void;
}

export class NotificationViewItemProgress extends Disposable implements INotificationViewItemProgress {
	private readonly _state: INotificationViewItemProgressState;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor() {
		super();

		this._state = Object.create(null);
	}

	get state(): INotificationViewItemProgressState {
		return this._state;
	}

	infinite(): void {
		if (this._state.infinite) {
			return;
		}

		this._state.infinite = true;

		this._state.total = undefined;
		this._state.worked = undefined;
		this._state.done = undefined;

		this._onDidChange.fire();
	}

	done(): void {
		if (this._state.done) {
			return;
		}

		this._state.done = true;

		this._state.infinite = undefined;
		this._state.total = undefined;
		this._state.worked = undefined;

		this._onDidChange.fire();
	}

	total(value: number): void {
		if (this._state.total === value) {
			return;
		}

		this._state.total = value;

		this._state.infinite = undefined;
		this._state.done = undefined;

		this._onDidChange.fire();
	}

	worked(value: number): void {
		if (typeof this._state.worked === 'number') {
			this._state.worked += value;
		} else {
			this._state.worked = value;
		}

		this._state.infinite = undefined;
		this._state.done = undefined;

		this._onDidChange.fire();
	}
}

export interface IMessageLink {
	href: string;
	name: string;
	title: string;
	offset: number;
	length: number;
}

export interface INotificationMessage {
	raw: string;
	original: NotificationMessage;
	linkedText: LinkedText;
}

export class NotificationViewItem extends Disposable implements INotificationViewItem {

	private static readonly MAX_MESSAGE_LENGTH = 1000;

	private _expanded: boolean | undefined;

	private _actions: INotificationActions | undefined;
	private _progress: NotificationViewItemProgress | undefined;

	private readonly _onDidChangeExpansion = this._register(new Emitter<void>());
	readonly onDidChangeExpansion = this._onDidChangeExpansion.event;

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private readonly _onDidChangeLabel = this._register(new Emitter<INotificationViewItemLabelChangeEvent>());
	readonly onDidChangeLabel = this._onDidChangeLabel.event;

	static create(notification: INotification, filter: NotificationsFilter = NotificationsFilter.OFF): INotificationViewItem | undefined {
		if (!notification || !notification.message || isPromiseCanceledError(notification.message)) {
			return undefined; // we need a message to show
		}

		let severity: Severity;
		if (typeof notification.severity === 'number') {
			severity = notification.severity;
		} else {
			severity = Severity.Info;
		}

		const message = NotificationViewItem.parseNotificationMessage(notification.message);
		if (!message) {
			return undefined; // we need a message to show
		}

		let actions: INotificationActions | undefined;
		if (notification.actions) {
			actions = notification.actions;
		} else if (isErrorWithActions(notification.message)) {
			actions = { primary: notification.message.actions };
		}

		return new NotificationViewItem(severity, notification.sticky, notification.silent || filter === NotificationsFilter.SILENT || (filter === NotificationsFilter.ERROR && notification.severity !== Severity.Error), message, notification.source, actions);
	}

	private static parseNotificationMessage(input: NotificationMessage): INotificationMessage | undefined {
		let message: string | undefined;
		if (input instanceof Error) {
			message = toErrorMessage(input, false);
		} else if (typeof input === 'string') {
			message = input;
		}

		if (!message) {
			return undefined; // we need a message to show
		}

		const raw = message;

		// Make sure message is in the limits
		if (message.length > NotificationViewItem.MAX_MESSAGE_LENGTH) {
			message = `${message.substr(0, NotificationViewItem.MAX_MESSAGE_LENGTH)}...`;
		}

		// Remove newlines from messages as we do not support that and it makes link parsing hard
		message = message.replace(/(\r\n|\n|\r)/gm, ' ').trim();

		// Parse Links
		const linkedText = parseLinkedText(message);

		return { raw, linkedText, original: input };
	}

	private constructor(
		private _severity: Severity,
		private _sticky: boolean | undefined,
		private _silent: boolean | undefined,
		private _message: INotificationMessage,
		private _source: string | undefined,
		actions?: INotificationActions
	) {
		super();

		this.setActions(actions);
	}

	private setActions(actions: INotificationActions = { primary: [], secondary: [] }): void {
		if (!Array.isArray(actions.primary)) {
			actions.primary = [];
		}

		if (!Array.isArray(actions.secondary)) {
			actions.secondary = [];
		}

		this._actions = actions;
		this._expanded = actions.primary.length > 0;
	}

	get canCollapse(): boolean {
		return !this.hasPrompt;
	}

	get expanded(): boolean {
		return !!this._expanded;
	}

	get severity(): Severity {
		return this._severity;
	}

	get sticky(): boolean {
		if (this._sticky) {
			return true; // explicitly sticky
		}

		const hasPrompt = this.hasPrompt;
		if (
			(hasPrompt && this._severity === Severity.Error) || // notification errors with actions are sticky
			(!hasPrompt && this._expanded) ||					// notifications that got expanded are sticky
			(this._progress && !this._progress.state.done)		// notifications with running progress are sticky
		) {
			return true;
		}

		return false; // not sticky
	}

	get silent(): boolean {
		return !!this._silent;
	}

	private get hasPrompt(): boolean {
		if (!this._actions) {
			return false;
		}

		if (!this._actions.primary) {
			return false;
		}

		return this._actions.primary.length > 0;
	}

	get hasProgress(): boolean {
		return !!this._progress;
	}

	get progress(): INotificationViewItemProgress {
		if (!this._progress) {
			this._progress = this._register(new NotificationViewItemProgress());
			this._register(this._progress.onDidChange(() => this._onDidChangeLabel.fire({ kind: NotificationViewItemLabelKind.PROGRESS })));
		}

		return this._progress;
	}

	get message(): INotificationMessage {
		return this._message;
	}

	get source(): string | undefined {
		return this._source;
	}

	get actions(): INotificationActions | undefined {
		return this._actions;
	}

	updateSeverity(severity: Severity): void {
		this._severity = severity;
		this._onDidChangeLabel.fire({ kind: NotificationViewItemLabelKind.SEVERITY });
	}

	updateMessage(input: NotificationMessage): void {
		const message = NotificationViewItem.parseNotificationMessage(input);
		if (!message) {
			return;
		}

		this._message = message;
		this._onDidChangeLabel.fire({ kind: NotificationViewItemLabelKind.MESSAGE });
	}

	updateActions(actions?: INotificationActions): void {
		this.setActions(actions);

		this._onDidChangeLabel.fire({ kind: NotificationViewItemLabelKind.ACTIONS });
	}

	expand(): void {
		if (this._expanded || !this.canCollapse) {
			return;
		}

		this._expanded = true;
		this._onDidChangeExpansion.fire();
	}

	collapse(skipEvents?: boolean): void {
		if (!this._expanded || !this.canCollapse) {
			return;
		}

		this._expanded = false;

		if (!skipEvents) {
			this._onDidChangeExpansion.fire();
		}
	}

	toggle(): void {
		if (this._expanded) {
			this.collapse();
		} else {
			this.expand();
		}
	}

	close(): void {
		this._onDidClose.fire();

		this.dispose();
	}

	equals(other: INotificationViewItem): boolean {
		if (this.hasProgress || other.hasProgress) {
			return false;
		}

		if (this._source !== other.source) {
			return false;
		}

		if (this._message.raw !== other.message.raw) {
			return false;
		}

		const primaryActions = (this._actions && this._actions.primary) || [];
		const otherPrimaryActions = (other.actions && other.actions.primary) || [];
		return equals(primaryActions, otherPrimaryActions, (a, b) => (a.id + a.label) === (b.id + b.label));
	}
}

export class ChoiceAction extends Action {

	private readonly _onDidRun = this._register(new Emitter<void>());
	readonly onDidRun = this._onDidRun.event;

	private readonly _keepOpen: boolean;

	constructor(id: string, choice: IPromptChoice) {
		super(id, choice.label, undefined, true, () => {

			// Pass to runner
			choice.run();

			// Emit Event
			this._onDidRun.fire();

			return Promise.resolve();
		});

		this._keepOpen = !!choice.keepOpen;
	}

	get keepOpen(): boolean {
		return this._keepOpen;
	}
}

class StatusMessageViewItem {

	static create(notification: NotificationMessage, options?: IStatusMessageOptions): IStatusMessageViewItem | undefined {
		if (!notification || isPromiseCanceledError(notification)) {
			return undefined; // we need a message to show
		}

		let message: string | undefined;
		if (notification instanceof Error) {
			message = toErrorMessage(notification, false);
		} else if (typeof notification === 'string') {
			message = notification;
		}

		if (!message) {
			return undefined; // we need a message to show
		}

		return { message, options };
	}
}
