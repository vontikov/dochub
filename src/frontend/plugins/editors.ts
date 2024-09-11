import { DocHub } from 'dochub-sdk';


export enum EditMode {
    edit = 'edit',
    view = 'view'
}

export interface IEditorParams {
    [id: string]: string
}

export interface IEditorContext {
    title: string;
    documentPath: string;
}

export interface IState {
    mode: EditMode,
    contexts: IEditorContext[]
}

interface IContext {
    state: IState;
    commit(id: string, ...data: any);
}

function findEditContext(url: string, contexts: IEditorContext[]) {
    const targetURL = new URL(url, window.location.href);
    const targetPath = `${targetURL.pathname}${JSON.stringify(Object.fromEntries(targetURL.searchParams))}`;
    return contexts.find((context) => {
        const thisURL = new URL(context.documentPath, window.location.href);
        const thisPath = `${thisURL.pathname}${JSON.stringify(Object.fromEntries(thisURL.searchParams))}`;
        return thisPath === targetPath;
    });
}


class EditStorage {
    state: IState = {
       mode: EditMode.view,
       contexts: []
    }

    mutations: any = {
        cleanContexts(state: IState) {
            state.contexts = [];
        },
        appendEditor(state: IState, editor: IEditorContext) {
            state.contexts.push(editor);
        },
        updateEditor(state: IState, editContext: IEditorContext) {
            const contextEditor = findEditContext(editContext.documentPath, state.contexts);
            contextEditor && (contextEditor.title = editContext.title);
        },
        removeEditor(state: IState, editor: IEditorContext) {
            state.contexts = state.contexts.filter((item) => item !== editor);
        },
        setPortalMode(state: IState, value: EditMode) {
            state.mode = value;
        }
    }

    actions: any = {
        // eslint-disable-next-line no-unused-vars
        closeAllEditors(context: IContext) {
            throw new Error('Not released method');
        },
        updateEditor(context: IContext, editContext: IEditorContext) {
            context.commit('updateEditor', editContext);
        },
        closeEditor(context: IContext, url: string) {
            const contextEditor = findEditContext(url, context.state.contexts);
            if (contextEditor) {
                let index = context.state.contexts.findIndex((context) => context === contextEditor) - 1;
                index = index < 0 ? 0 : index;
                context.commit('removeEditor', contextEditor);
                index = index >= context.state.contexts.length ? context.state.contexts.length - 1 : index;
                index >= 0 && DocHub.router.navigate(`/editor/${context.state.contexts[index].documentPath}`);
            }
        },
        openEditor(context: IContext, editContext: IEditorContext) {
            !context.state.contexts.find((context) => context.documentPath === editContext.documentPath)
                && context.commit('appendEditor', editContext);

            // Задержка требуется для того, чтобы фронт успел перейти в режим редактирования
            setTimeout(
                () => DocHub.router.navigate(`/editor/${editContext.documentPath}`),
                50
            );
        }
    }
}

export default new EditStorage();
