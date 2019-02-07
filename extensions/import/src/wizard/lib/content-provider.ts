import TextProcessRuleApplier from './text-process-rule-applier';
import SelectionInfoRegistry from './selection-info-registry';
import {extractTextKey} from './utils/text-resource';
import NormalisationRuleStore from './normalisation-rule-store';
import * as vscode from 'vscode';
import {TextDocumentContentProvider} from 'vscode';

export default class ContentProvider implements TextDocumentContentProvider {
    private readonly selectionInfoRegistry: SelectionInfoRegistry;
    private readonly textProcessRuleApplier: TextProcessRuleApplier;

    constructor(selectionInfoRegistry: SelectionInfoRegistry,
                normalisationRuleStore: NormalisationRuleStore) {
        this.selectionInfoRegistry = selectionInfoRegistry;
        this.textProcessRuleApplier = new TextProcessRuleApplier(normalisationRuleStore);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        const textKey = extractTextKey(uri);
        const registeredText = (
            this.selectionInfoRegistry.get(textKey) || {text: ''}
        ).text;
        return this.textProcessRuleApplier.applyTo(registeredText);
    }
}
