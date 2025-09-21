export declare class GitChangedFilesProvider {
    private rootDir;
    constructor(rootDir: string);
    getGitChangedFiles(): Promise<string[]>;
    getDeletedFiles(): string[];
}
