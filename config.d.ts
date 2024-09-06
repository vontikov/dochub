// eslint-disable-next-line no-var
declare var DocHub: any;
// eslint-disable-next-line no-var
declare var Router: any;

// eslint-disable-next-line no-var
declare var DochubVsCodeExt: {
  metamodelUri: {
    $mid: number;
    authority: string;
    path: string;
    scheme: string;
  };

  rootManifest: string,
  settings: {
    isEnterprise: boolean,    // Признак использования фронта в плагине как Enterprise портала
    enterpriseServer?: string,
    render: {
      external: boolean,
      mode: string,
      request_type: string,
      server: string
    };
    env: {                    // Переменные среды для IDE режима
      DOCHUB_IDE_GITLAB_URL?: string,     // gitlab сервер для режима IDE
      DOCHUB_IDE_BITBUCKET_URL?: string,  // bitbacket сервер для режима IDE
      DOCHUB_IDE_PERSONAL_TOKEN?: string, // персональный токен для gitlab/bitbacket
    };
  }
};

// eslint-disable-next-line no-var
declare var DocHubIDEACodeExt: {
  rootManifest: string,       // Корневой манифест (с чего начинается загрузка)
  settings: {
    [x: string]: {};
    isEnterprise: boolean,    // Признак использования фронта в плагине как Enterprise портала
    enterpriseServer?: string,
    render: {
      external: boolean,      // Признак рендера на внешнем сервере
      mode: string,           // Режим рендера ELK / Smetana / GraphVis
      request_type: string,   // Тип запросов к сервер рендеринга POST / GET
      server: string          // Сервер рендеринга
    };
    env: {                    // Переменные среды для IDE режима
      DOCHUB_IDE_GITLAB_URL?: string,     // gitlab сервер для режима IDE
      DOCHUB_IDE_BITBUCKET_URL?: string,  // bitbacket сервер для режима IDE
      DOCHUB_IDE_PERSONAL_TOKEN?: string, // персональный токен для gitlab/bitbacket
    };
  }
};

declare const vscode: {
  postMessage: ({
    command,
    content
  }: {
    command: string,
    content: any
  }) => Promise<any> | void
};

interface Window { $PAPI: any; }
