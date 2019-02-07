import * as vscode from 'vscode';
import {EXTENSION_SCHEME} from '../const';

export const makeUriString = (textKey: string, timestamp: Date): string =>
    `${EXTENSION_SCHEME}:text/${textKey}?_ts=${timestamp.getTime()}`; // `_ts` to avoid cache

export const extractTextKey = (uri: vscode.Uri): string =>
    uri.path.match(/^text\/([a-z\d]+)/)![1];
