
export type SavedNormalisationRule = {
    name?: string;
    match: string;
    replaceWith: string | {letterCase: 'upper' | 'lower'};
    enableOnStart?: boolean;
};

export interface LoadedNormalisationRule extends Exclude<SavedNormalisationRule, 'enableOnStart'> {
    active: boolean;
}
