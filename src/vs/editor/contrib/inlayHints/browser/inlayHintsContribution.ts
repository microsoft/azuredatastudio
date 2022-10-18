/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { HoverParticipantRegistry } from 'vs/editor/contrib/hover/browser/hoverTypes';
import { InlayHintsController } from 'vs/editor/contrib/inlayHints/browser/inlayHintsController';
import { InlayHintsHover } from 'vs/editor/contrib/inlayHints/browser/inlayHintsHover';

registerEditorContribution(InlayHintsController.ID, InlayHintsController);
HoverParticipantRegistry.register(InlayHintsHover);
