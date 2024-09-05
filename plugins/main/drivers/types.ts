
export interface IGitAPI {
    // Текущая ветка
    currentBranch() : string | null;
    // Переключает бранч
    checkout(to: string, repo: string, owner: string): Promise<any>;
    // Сравнивает бранчи и возвращает разницу
    compare(from: string, to: string, repo: string, owner: string): Promise<any>;
    // Возвращает контент по указанному URI
    getContent(uri: string): Promise<any>;
    // Создает контент с указанным URI
    postContent(uri: string, content: any): Promise<any>;
    // Возвращает список репозиториев
    fetchRepos(): Promise<any>;
    // Возвращает список бранчей
    fetchBranches(repo: string): Promise<any>;
    // Возвращает профиль пользователя
    fetchUser(): Promise<any>;
    // Возвращает список файлов
    fetchFiles(path: string, branch: string, repo: string): Promise<any>;
    // Конвертирует URL во внутренний формат протокола
    convertURL(url: string): string | null;
}

export interface IProtocolUserProfile {
    avatarURL: string;  // Ссылка на аватар пользователя
    userName: string;   // Имя пользователя
}

export interface IProtocolStatus extends IProtocolUserProfile {
    api: IGitAPI;           // API интерфейс драйвера протокола
    isActive: boolean;      // Признак активности драйвера
    isLogined: boolean;     // Признак авторизации пользователя
}

export interface IComplexStatus {
    gitlab: IProtocolStatus | null;     // Статус GitLab драйвера
    github: IProtocolStatus | null;     // Статус GitHub драйвера
    bitbucket: IProtocolStatus | null;  // Статус Bitbucket драйвера
}
