const nameDictionary = { 
  integrationId: ['integration','integrationId'],
  accountId: ['accountId'],
  contactId: ['contactId'],
  contactDetailsId: ['contactDetailsId'],
  phone:[ //will be spread into chatType and chatId
          //if those are not present and then will be deleted from
          //ctx result object
    '__temp_phone', 'phone','chatId'],
  chatType: ['chatType', 'transport'],
  chatId: ['chatId'],
  messageId: ['messageId'],
  channelId: ['channelId']
}

module.exports.nameDictionary = nameDictionary

module.exports.keyDictionary =  (function (reverseThis) {  
  let result = {};
  Object.keys(reverseThis).forEach(function (field) {
    reverseThis[field].forEach(function (fieldName) {
      result[fieldName] = field;
    })
  })
  return result
})(nameDictionary)