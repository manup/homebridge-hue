// homebridge-hue/lib/HueBridgeService.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//

const LibService = require('homebridge-lib').LibService;

module.exports = class HueBridgeService extends LibService {

  constructor(bridge, context) {
    context.type = 'HueBridge';
    super(bridge , context);

  }

};
