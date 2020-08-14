

module.exports.config = {
  loggingURL: process.env.LOGGING_URL || "fluentd-service.logging.svc.cluster.local",
  loggingPort: process.env.LOGGING_PORT || 24224,
  loggingTag: process.env.LOGGING_TAG || (process.env.IS_DEV ? "dev-": "") + "core",
  telebot: {
    chatId: process.env.LOG_CHAT_ID || (process.env.IS_DEV ? '-323800565': '-396840109'),
    token: process.env.LOG_CHAT_TOKEN || '586936759:AAFWGYfjdkfnJDJSKdjrjCKLdserYRErcxc' // fake token
  }
}