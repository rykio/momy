'use strict'

const moment = require('moment')
const sqlstring = require('sqlstring')

const controlRegex = /[\x00-\x1F\x7F]/g // eslint-disable-line no-control-regex
const NATIVE_TYPES = {
  'BIGINT': {
    type: 'BIGINT',
    convert: val => parseInt(val || 0)
  },
  'INT': {
      type: 'INT',
      convert: val => parseInt(val || 0)
  },
  'DATE': {
    type: 'DATE',
    convert: val => {
      if (typeof val === 'string') val = getValueOfDate(val)
      if (typeof val !== 'number' && typeof val !== 'object') return 'NULL'
      val = moment(val).format('YYYY-MM-DD')
      return `"${val}"`
    }
  },
  'DATETIME': {
    type: 'DATETIME',
    convert: val => {
      if (typeof val === 'string') val = getValueOfDate(val)
      if (typeof val !== 'number' && typeof val !== 'object') return 'NULL'
      val = moment(val).format('YYYY-MM-DD HH:mm:ss')
      return `"${val}"`
    }
  },
  'DOUBLE': {
    type: 'DOUBLE(20, 10)',
    convert: val => parseFloat(val || 0)
  },
  'TIME': {
    type: 'TIME',
    convert: val => {
      if (typeof val === 'string') val = normalizeTime(val)
      if (typeof val === 'number') val = moment(val).format('HH:mm:ss')
      if (typeof val !== 'string') return 'NULL'
      return `"${val}"`
    }
  },
  'TINYINT': {
    type: 'TINYINT',
    convert: val => !!val
  },
  'VARCHAR': {
    type: 'VARCHAR(255)',
    convert: val => {
      val = (val || '').toString()
      val = val.substring(0, 255)
      val = sqlstring.escape(val) // escape \0 \b \t \n \r \x1a
      val = val.replace(controlRegex, '')
      return val
    }
  },
  'SMALLCHAR': {
    type: "VARCHAR(100)",
    convert: val => {
      val = (val || '').toString()
      val = val.substring(0, 100)
      val = sqlstring.escape(val) // escape \0 \b \t \n \r \x1a
      val = val.replace(controlRegex, "")
      return val
    }
  },
  'TEXT': {
    type: 'TEXT',
    convert: val => {
      val = (val || '').toString()
      val = sqlstring.escape(val) // escape \0 \b \t \n \r \x1a
      val = val.replace(controlRegex, '')
      return val
    }
  },
  'ARRAY': {
    type: 'TEXT',
    convert: val => {
      if (val) {
        val = JSON.stringify(val)
        val = sqlstring.escape(val) // escape \0 \b \t \n \r \x1a
        val = val.replace(controlRegex, '')
        return val
      } else {
        return sqlstring.escape('')
      }
    }
  },
  'OBJECT': {
    type: 'TEXT',
    convert: val => {
      val = JSON.stringify(val || [])
      val = sqlstring.escape(val) // escape \0 \b \t \n \r \x1a
      val = val.replace(controlRegex, '')
      return val
    }
  }
}

const NON_NATIVE_TYPES = {
  'IP_TO_REGION': {
    type: 'VARCHAR(255)',
    convert: (val, utils) => {
      const promise = new Promise((resolve, reject) => {
        let valStr = (val || '').toString()
        valStr = getPublicIPv4(valStr)
        if (valStr) {
          utils.ip_to_region(valStr).then((result) => {
            valStr = result && typeof result.adcode === 'string' ? result.adcode : '';
            valStr = sqlstring.escape(valStr)
            resolve(valStr)
          })
          .catch(err => {
            console.log(err)
            resolve(sqlstring.escape(''))
          })
        } else {
          resolve(sqlstring.escape(''))
        }
      })
      return promise;
    }
  },
  'GEO_TO_REGION': {
    type: 'VARCHAR(255)',
    convert: (val, utils) => {
      const promise = new Promise((resolve, reject) => {
        if (val && val.length === 2 ) {
          utils.geo_to_region({
            lng: val[0].toFixed(6),
            lat: val[1].toFixed(6)
          }).then((result) => {
            var valStr = result
              && result.regeocode
              && result.regeocode.addressComponent
              && result.regeocode.addressComponent.adcode
              && typeof result.regeocode.addressComponent.adcode === 'string' ?
              result.regeocode.addressComponent.adcode : '';
            valStr = sqlstring.escape(valStr)
            resolve(valStr)
          })
          .catch(err => {
            console.log(err)
            resolve(sqlstring.escape(''))
          })
        } else {
          resolve(sqlstring.escape(''))
        }
      })
      return promise;
    }
  }
}

function getPublicIPv4 (str) {
  //const re = /(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]{1,2})(\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})){3}/
  const re = /\b(?!(10)|192\.168|172\.(2[0-9]|1[6-9]|3[0-2]))[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
  if (!re.test(str)) return ''
  const found = str.match(re)
  return found[0] || ''
}

/**
 * Get a number expression from a date string
 * @param {string} str - date value
 * @returns {number|null} Timestamp in msec or null if not a valid value
 */
function getValueOfDate (str) {
  const reIso8601 = /^\d{4}-\d{2}-\d{2}([ T]\d{2}(:\d{2}(:\d{2}(\.\d{3})?)?)?([+-]\d{2}(:?\d{2})?)?)?$/
  const reIso8601Short = /^\d{4}\d{2}\d{2}(T\d{2}(\d{2}(\d{2}(\.\d{3})?)?)?)?$/
  const reTimestamp = /^\d+$/
  if (reIso8601.test(str) || reIso8601Short.test(str)) return moment(str).valueOf()
  if (reTimestamp.test(str)) return parseInt(str)
  return null
}

/**
 * Get a normalized time string
 * @param {string} str - time value
 * @returns {string|null} time or null
 */
function normalizeTime (str) {
  const re = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/
  if (!re.test(str)) return null
  const found = str.match(re)
  const hh = found[1].length === 1 ? '0' + found[1] : found[1]
  const mm = found[2]
  const ss = found[4] || '00'
  return `${hh}:${mm}:${ss}`
}

exports.NATIVE_TYPES = NATIVE_TYPES
exports.NON_NATIVE_TYPES = NON_NATIVE_TYPES
