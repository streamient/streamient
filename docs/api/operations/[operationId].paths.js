import { usePaths } from 'vitepress-openapi';
import spec from '../../.vitepress/data/openapi.json' with { type: 'json' };

export default {
    paths() {
        return usePaths({ spec })
            .getPathsByVerbs()
            .map(({ operationId, summary }) => {
                return {
                    params: {
                        operationId,
                        pageTitle: `${summary} - Streamient API`,
                    },
                };
            });
    },
};
