export default {
    data() {
        return {
            status: {
                gitlab: null,
                github: null,
                bitbucket: null
            }
        };
    },
    mounted() {
        DocHub.eventBus.$on('gitlab-status-change', this.setGitlabStatus);
        DocHub.eventBus.$on('github-status-change', this.setGitHubStatus);
        DocHub.eventBus.$on('bitbucket-status-change', this.setBitbucketStatus);
        DocHub.eventBus.$emit('gitlab-status-get');
        DocHub.eventBus.$emit('github-status-get');
        DocHub.eventBus.$emit('bitbucket-status-get');
    },
    unmounted() {
        DocHub.eventBus.$off('gitlab-status-change', this.setGitlabStatus);
        DocHub.eventBus.$off('github-status-change', this.setGitHubStatus);
        DocHub.eventBus.$off('bitbucket-status-change', this.setBitbucketStatus);
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
        refresh() {}
    }

};
