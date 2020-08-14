const assert =  require('assert') ;
const {Logger} =  require('../src/index')
const loggerConfig =  require('./testLoggerConfig')

let Log;

describe('logging test', function () {
  before(function () { 
    Log = Logger(loggerConfig);
  })
  it('general test', function () {
    let logData = Log.trace({
      contactId: "YES",
      a: {
        b: {
          constactId:"NO",
          integration: 'YES'
        },
        integrationId: 'NO',
        c: {
          __temp_phone: "@YES",
          phone: "NO",
          chatId: "NO"

        }
      },
      integration: 'NO'
    })
    assert.deepStrictEqual(logData._ctx, {
    contactId: 'YES',
     integretionId: 'YES',
     chatId: 'YES',
     chatType: 'instagram'
    })
  })
  it('test chatId and chatType', function () {
    let logData = Log.trace({
      a: {
        b: {
          chatId: "YES"
        },
        chatType: "YES",
        c: {
          chatId: "NO"
        },
        phone:'NO'
      }
    })
    assert.deepStrictEqual(logData._ctx, {
      chatId: 'YES', chatType: 'YES' 
    })
  })
  it('test chatType but not chatId', function () {
    let logData = Log.trace({
      a: {
        b: {
          __temp_phone: 99999999999
        },
        c: {
          chatType: "NO"
        },
        phone: 'NO'
      }
    })
    assert.deepStrictEqual(logData._ctx, {
      chatId: 99999999999, chatType: 'whatsapp' 
    })
  })
  it('test chatId but not chatType', function () {
    let logData = Log.trace({
      a: {
        b: {
          chatId: "NO"
        },
        c: {
          chatId: "NO"
        },
        phone:'YES',
        __temp_phone: 'NO'
      }
    })
    assert.deepStrictEqual(logData._ctx, {
      chatId: 'YES', chatType: 'instagram' 
    })
  })
  it('test short phone', function () {
    let logData = Log.trace({
      a: {
        b: {
          __temp_phone: 123123
        },
        c: {
          chatId: "NO",
          phone:'NO',
        __temp_phone: 'NO'
        },
      }
    })
    assert.deepStrictEqual(logData._ctx, {
      chatId: 123123, chatType: 'instagram' 
    })
  })
  it('test none', function () {
    let logData = Log.trace({})
    assert.deepStrictEqual(logData._ctx, {}
    )
  })
  it("test _ctx is present", function () {
    let logData = Log.trace({_ctx: {
        chatId: 123123,
        chatType: 'whatsapp',
        accountId: 12341234
      },
      accountId: 9999999,
      phone: "@NO",
      integration: "YES" 
    },{
      body: {
        a: {
          accountId:"NO"
        },
        b: {
          phone: "NO"
        }
      },
      integrationId:"NO",
      integration: "NO"
    })
    assert.deepStrictEqual(logData._ctx, { 
      chatId: 123123,
      chatType: 'whatsapp',
      accountId: 12341234,
      integretionId: 'YES'
    })
  })
})