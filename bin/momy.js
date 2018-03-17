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
   * @param {object} task - task configulation
   */
  constructor(task, customUtils) {
    const config_path =  task.config || DEFAULT_CONFIG_PATH;
    this.config = JSON.parse(fs.readFileSync(process.cwd() + '/' + config_path))
    this.tailer = new Tailer(Object.assign({},this.config,{
      src: task.src || this.config.src,
      dist: task.dist || this.config.dist
    }), customUtils)
  }

  /**
   * Start import and tailing
   */
  start() {
    this.tailer.importAndStart()
  }
}

module.exports = Momy
