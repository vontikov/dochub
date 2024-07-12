export default {
    data() {
        return {
            status: {
                gitlab: null,
                github: null
            }
        };
    },
    mounted() {
        DocHub.eventBus.$on('gitlab-status-change', this.setGitlabStatus);
        DocHub.eventBus.$on('github-status-change', this.setGitHubStatus);
        DocHub.eventBus.$emit('gitlab-status-get');
        DocHub.eventBus.$emit('github-status-get');
    },
    unmounted() {
        DocHub.eventBus.$off('gitlab-status-change', this.setGitlabStatus);
        DocHub.eventBus.$off('github-status-change', this.setGitHubStatus);
    },
    methods: {
        setGitlabStatus(status) {
            this.status.gitlab = status;
            this.refresh();
        },
        setGitHubStatus(status) {
            this.status.github = status;
            this.refresh();
        },
        refresh() {
            console.warn('Status mixin: not released method refresh()!');
        }
    }

};
