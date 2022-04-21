export interface PushDepTask {
    id?: string;
    kind: string;
    depIds?: string[];
    payload?: any;
}

export interface PushDep {
    pushAsync(options: PushDepTask): Promise<string>;
}
