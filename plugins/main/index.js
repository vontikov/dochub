// Драйверы протокола
import gitlab from './drivers/gitlab';

// Драйверы данных
import json from './providers/json';
import yaml from './providers/yaml';
import xml from './providers/xml';

DocHub.protocols.register('gitlab', gitlab);

DocHub.contentProviders.register('json', json);
DocHub.contentProviders.register('text/json', json);
DocHub.contentProviders.register('application/json', json);
DocHub.contentProviders.register('application/ld+json', json);

DocHub.contentProviders.register('yaml', yaml);
DocHub.contentProviders.register('text/yaml', yaml);
DocHub.contentProviders.register('application/yaml', yaml);
DocHub.contentProviders.register('application/x-yaml', yaml);

DocHub.contentProviders.register('xml', xml);
DocHub.contentProviders.register('text/xml', xml);
DocHub.contentProviders.register('application/xml', xml);
DocHub.contentProviders.register('application/xhtml+xml', xml);



