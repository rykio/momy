#!/usr/bin/env node

'use strict'

const Tailer = require('../lib/tailer.js')
const fs = require('fs')
const DEFAULT_CONFIG_PATH = 'momyfile.json'

/**
 * Momy
 * @class
 */
class Momy {

  /**
   * Constructor
   * @param {string} config_file - configulation filename
   */
  constructor(config_file) {
    const config_path =  config_file || DEFAULT_CONFIG_PATH;
    this.config = JSON.parse(fs.readFileSync(process.cwd() + '/' + config_path))
    this.tailer = new Tailer(this.config)
  }

  /**
   * Start import and tailing
   */
  start() {
    this.tailer.importAndStart()
  }
}

module.exports = Momy
