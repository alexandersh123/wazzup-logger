const process =  require('process');
const logger = require('fluent-logger');
const CircularJSON = require('circular-json');
const HTTP = require('http');
const Telebot = require('telebot');
const configTelebot = require('./config/telegram');
const Raven = require('raven')
const winston  = require('winston');
const { Loggly } = require('winston-loggly-bulk');

const { keyDictionary } = require('./config/ctx')

let bot;

/**
 * @param config Формат: {
 *               loggingURL: 'url to fluentd service',
 *               loggingPort: 'port',
 *               loggingTag: 'service name',
 *               telebot: {
 *                 token: Token for telegram-bot,
 *                 chatId: Id for log-chat,
 *                 chats: process.env.IS_DEV ? {
 *                   debug: -00000000,
 *                 } : false // Disable chat for production 
 *               }
 *               sentry: {
 *                 url: 'url to sentry'
 *                 levels: [ 'error', 'warning' ]
 *               }
 * }
 */
let config;
let logging;
let options;

function Warning (message) {
  this.name = "Warning"
  this.message = message
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor)
  } else {
    this.stack = (new Error()).stack
  }
}
Warning.prototype = Object.create(Error.prototype);
Warning.prototype.constructor = Warning;

function ErrorWithoutLogging (data, code) {

  this.name = "ErrorWithoutLogging"
  this.message = "Error without logging"
  if (code) this.code = code

  if (typeof data === 'string') {
    this.message = data
  } else if (data && typeof data === 'object') {
    if (data.message) {
      this.message = data.message
      delete data.message
    }
    if (Object.keys(data).length) this.data = data
  } else {
    this.data = data
  }

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor)
  } else {
    this.stack = (new Error()).stack
  }
}

function traceRequest(req, mark) { // eslint-disable-line no-unused-vars
  if (!req.___trace) {
    if (mark === 'init') {
      req.___trace = {
        start: new Date(),
        nextStart: Date.now(),
        t: []
      }
    } else {
      return
    }
  } else {
    let now = Date.now()
    let timeout = (now - req.___trace.nextStart)
    req.___trace.t.push(mark ? [ timeout, mark ] : timeout)
    req.___trace.nextStart = now
  }
}

function normalize(data) {
  if (!data._ctx) data._ctx = {}
  const replacer = (key, value) => {
    if (value instanceof Error) {

      let result = {}
      let keys = ['name', 'message', 'stack']

      Object.keys(value).forEach(key => { result[key] = value[key] })
      keys.forEach(key => { if (!result[key] && value[key]) result[key] = value[key] })

      return result

    } else if (value instanceof HTTP.IncomingMessage) {

      let result = {}
      let keys = [ 'method', 'originalUrl', 'body', 'params', 'query', '___trace' ]
      if (options.logRequestHeaders) keys.push('headers')

      keys.forEach(key => { if (value[key]) result[key] = value[key] })
      result.timeout = new Date(new Date() - value.startTime).getTime();

      return result

    } else if (value instanceof HTTP.ServerResponse) {

      let result = {}
      let keys = [ 'statusCode', 'statusMessage', 'body' ]

      keys.forEach(key => { if (value[key]) result[key] = value[key] })

      return result

    } else if (
      // this is response.toJSON() (responseToJSON)
      value && typeof value === 'object'
      && Object.keys(value).length === 4 && value.statusCode && value.body && value.headers && value.request
      && Object.keys(value.request).length === 3 && value.request.uri && value.request.method && value.request.headers
    ) {

      let result = { statusCode: value.statusCode, body: value.body }
      if (options.logRequestHeaders) result.headers = value.headers
      return result

    } else if (options.hideBufferContents && (
      (value instanceof Buffer)
      // this is Buffer.toJSON() { type: 'Buffer', data: [ ... ] }
      || (value && typeof value === 'object' && Object.keys(value).length === 2 && value.type === 'Buffer' && value.data instanceof Array)
    )) {

      return `[ Buffer, ${value instanceof Buffer ? value.length : value.data.length} bytes ]`

    } else if (typeof value === 'string' && value.length > options.trimLongLines.maxLength) {
      
      return `${value.substr(0, options.trimLongLines.keepFirst)} [ ...... ] ${value.substr(-options.trimLongLines.keepLast)} [ long string, total length = ${value.length} ]`

    } else if (value && typeof value === 'object' //pass forward all object
    && Object.keys(value).length !==0 ) {
      return value
    } 
    if (value && keyDictionary[key] && !data._ctx[keyDictionary[key]]) {
      data._ctx[keyDictionary[key]] = value;
    }
    return value

  }
  try {
    let parsed = JSON.parse(CircularJSON.stringify(data, replacer));

    if (!(data._ctx.chatId && data._ctx.chatType) ) {

      if (data._ctx.chatId && !data._ctx.phone) data._ctx.phone = data._ctx.chatId

      if (data._ctx.phone){
        if (/^\d{11,14}$/.test(data._ctx.phone)) {
          data._ctx.chatId = data._ctx.phone
          data._ctx.chatType = 'whatsapp'
        } else {
          data._ctx.chatId = typeof data._ctx.phone === 'string' && data._ctx.phone.startsWith('@')? data._ctx.phone.slice(1): data._ctx.phone;
          data._ctx.chatType = 'instagram'
        }
      }
    }
    delete data._ctx.phone;
    parsed._ctx = data._ctx; 
    return parsed;
  } catch (error) {
    console.log(error);
    console.log(data);
    return {
      circularError: error.message,
      keys: Object.keys(data)
    }
  }
}

function send (level, data = {}, req, res) { // eslint-disable-line

  if (process.env.NO_LOGGING) {
    return
  }

  if (process.env.NODE_ENV === 'test') {
    if ((level !== 'trace') && (level !== 'info')) {
      console.log(data);
      throw new Error(data);
    }
    return;
  }

  if (level === 'info') console.log(data)

  if (typeof data === 'string') data = { message: data }

  let replaceableProps = ['level', 'module' ]
  if (req) replaceableProps.push('request')
  if (res) replaceableProps.push('response')

  replaceableProps.forEach(key => {
    if (key in data) {
      let newKey = '_' + key
      while (newKey in data) newKey = '_' + newKey
      data[newKey] = data[key]
    }
  })

  if (data.error && data.error instanceof ErrorWithoutLogging && (level === 'error')) {
    data.level = 'warning'
  } else {
    data.level = level
  }

  data.NODE_ENV = process.env.NODE_ENV

  // Изменение порядка свойств объекта. Немного костыль.
  const newData = {};
  newData.module = config.loggingTag;

  if (req) data.request = req
  if (res) data.response = res

  Object.assign(newData, data);

  let logData = normalize(newData)

  if (process.env.NODE_ENV === 'test_logger') {
    return logData; 
  }

  if (process.env.IS_LOCAL) {
    console.log(logData)
    return
  }

  logging.emit('', logData);

  if (config.sentry && config.sentry.url && Array.isArray(config.sentry.levels) && config.sentry.levels.includes(logData.level)) {
    let errMessage = logData.message || logData.error.description || 'Unknown error'
    let err = logData.level === 'warning' ? new Warning(errMessage) : new Error(errMessage)
    Raven.captureException(err, { extra: logData, level: logData.level })
  }

  if (config.winstonInitialized) {
    winston.log(logData);
  }

  if (bot){
    // Если для этого сообщения этого уровня есть отдельный чат - то отсылаем его туда.
    try {
      if (config.telebot.chats && config.telebot.chats[logData.level]) {
        sendToTelegram(JSON.stringify(logData, null, '  '), config.telebot.chats[logData.level]);
      } else if (logData.level === 'error' || logData.level === 'info') {
        // Если нет - отсылаем в общий чат, если уровень сообщения подходит для этого
        sendToTelegram(JSON.stringify(logData, null, '  '), config.telebot.chatId); 
      } 
    } catch (error) {
      console.log('TELEBOT ERROR: ' + error);
    }
  }
}



class LoggingService {

  trace (data, req, res) { return send('trace', data, req, res) }

  warning (data, req, res) { send('warning', data, req, res) }

  error (data, req, res) { send('error', data, req, res) }

  critical (data, req, res) { send('critical', data, req, res) }

  info (data, req, res) { send('info', data, req, res) }

  debug (data, req, res) { send('debug', data, req, res) }

}

ErrorWithoutLogging.prototype = Object.create(Error.prototype);
ErrorWithoutLogging.prototype.constructor = ErrorWithoutLogging;

module.exports.Logger = function(configLogger) {
// TODO: нужна проверка конфигурации.
  if (!configLogger) {
    throw new Error('Need config');
  }
  config = configLogger;
  logging = logger.createFluentSender((process.env.IS_DEV ? "dev-": "") + config.loggingTag, {
    host: config.loggingURL,
    port: config.loggingPort,
    timeout: 3.0,
    reconnectInterval: 60000 // 1 min
  })

  options = {
    logRequestHeaders: false,
    hideBufferContents: true,
    trimLongLines: {
      maxLength: 10000,
      keepFirst: 500,
      keepLast: 100
    }
  }

  if (config.telebot) {
    try {
      configTelebot.token = config.telebot.token;
      bot = new Telebot(configTelebot);
    } catch (error) {
      console.log(error);
    }
  }

  if (config.sentry && config.sentry.url) Raven.config(config.sentry.url, {
    autoBreadcrumbs: true
  }).install()

  if (config.loggly && config.loggly.token && config.loggly.subdomain) {
    winston.add(new Loggly({
      token: config.loggly.token,
      subdomain: config.loggly.subdomain,
      tags: [ config.loggingTag || 'NodeJS' ],
      json: true
    }));
    config.winstonInitialized = true
  }

  return new LoggingService();
};


function sendToTelegram(data, chatId) {
  // Check size of message. Max size is 4096 UTF8 characters.
  if (data.length > 4001) {
    data = data.slice(0, 4000);
  }
  bot.sendMessage(chatId, data).catch(error => {
    console.log(error);
  });
}

// Node modules.
module.exports.ErrorWithoutLogging = ErrorWithoutLogging;
module.exports.traceRequest = traceRequest;
