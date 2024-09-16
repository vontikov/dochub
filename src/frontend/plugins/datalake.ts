import { IDataLakeChange, IDocHubCore, IDocHubDataLake } from 'dochub-sdk';
import events from './events';

export interface IDocHubMountedURI {
    [uri: string]: boolean;
}

export class DocHubDataLake implements IDocHubDataLake {
    mountedURI: IDocHubMountedURI;
    dochub: IDocHubCore;
    constructor(dochub: IDocHubCore) {
        this.dochub = dochub;
    }
    // eslint-disable-next-line no-unused-vars
    mountManifest(uri: string) {
        this.mountedURI.mounted[uri] = true;
        this.dochub.eventBus.$emit(events.dataLake.mountManifest, uri);
    }
    // eslint-disable-next-line no-unused-vars
    unmountManifest(uri: string) {
        delete this.mountedURI.mounted[uri];
        this.dochub.eventBus.$emit(events.dataLake.unmountManifest, uri);
    }
    // eslint-disable-next-line no-unused-vars
    reload(uriPattern?: string | string[] | RegExp) {
        this.dochub.eventBus.$emit(events.dataLake.reloadManifests,
            uriPattern &&
            ((Array.isArray(uriPattern) ? uriPattern : [uriPattern]).map((item) => typeof item === 'string'
                ? new RegExp('^' + item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
                : item
            )
            )
        );
    }
    // eslint-disable-next-line no-unused-vars
    pushChanges(changes: IDataLakeChange[]) {
        console.table(changes);
    }
}
