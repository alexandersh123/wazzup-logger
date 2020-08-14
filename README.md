This is wazzup logger.

Init example:
```
const configLogger = {
    loggingURL: 'url to fluentd service',
    loggingPort: 'port',
    loggingTag: 'service name',
    telegramBotURL: 'url to telebot service with port'
}
const Log = require('wazzup-logger').Logger(configLogger);
```