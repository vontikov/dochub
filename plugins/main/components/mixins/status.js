import bitbucket from '../../drivers/bitbucket';
import gitlab from '../../drivers/gitlab';
import github from '../../drivers/github';

export default {
    data() {
        const status = {
            gitlab: null,
            github: null,
            bitbucket: null
        };

        return {
            status
        };
    },
    mounted() {
        DocHub.eventBus.$on(gitlab.Events.statusChange, this.setGitlabStatus);
        DocHub.eventBus.$on(github.Events.statusChange, this.setGitHubStatus);
        DocHub.eventBus.$on(bitbucket.Events.statusChange, this.setBitbucketStatus);
        DocHub.eventBus.$emit(gitlab.Events.statusGet);
        DocHub.eventBus.$emit(github.Events.statusGet);
        DocHub.eventBus.$emit(bitbucket.Events.statusGet);
    },
    unmounted() {
        DocHub.eventBus.$off(gitlab.Events.statusChange, this.setGitlabStatus);
        DocHub.eventBus.$off(github.Events.statusChange, this.setGitHubStatus);
        DocHub.eventBus.$off(bitbucket.Events.statusChange, this.setBitbucketStatus);
    },
    methods: {
        setGitlabStatus(status) {
            this.status = Object.assign(this.status || {}, { gitlab: status }) ;
            this.refresh();
        },
        setGitHubStatus(status) {
            this.status = Object.assign(this.status || {}, { github: status }) ;
            this.refresh();
        },
        setBitbucketStatus(status) {
            this.status = Object.assign(this.status || {}, { bitbucket: status }) ;
            this.refresh();
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        refresh() {}
    }
};
