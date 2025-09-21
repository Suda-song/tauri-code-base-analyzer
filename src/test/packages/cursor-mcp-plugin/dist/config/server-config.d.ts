export declare const serverConfig: {
    name: string;
    version: string;
    workspacePaths: string;
    entitiesFilePaths: string;
    returnDirect: boolean;
};
export declare const toolTriggers: {
    "start-analysis": {
        priority: number;
        default: boolean;
        patterns: RegExp[];
    };
};
