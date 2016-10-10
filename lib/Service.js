var parseString = require('xml2js').parseString;
var xmlbuilder = require('xmlbuilder');
var request = require('request');
var _ = require('underscore');

var isInDirection = function(argument) {
  return argument.direction === "in";
};

var isOutDirection = function(argument) {
  return argument.direction === "out";
};

var sendsEvents = function(stateVariable) {
  return stateVariable.$.sendEvents === "yes";
};

var getInArguments = function(argumentList) {
  if(argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isInDirection).map(function(argument) {
      return argument.name;
    });
  } else if (argumentList && argumentList.argument && isInDirection(argumentList.argument)) {
    return [argumentList.argument.name];
  } else {
    return [];
  }
};

var getOutArguments = function(argumentList) {
  if(argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isOutDirection).map(function(argument) {
      return argument.name;
    });
  } else if (argumentList && argumentList.argument&& isOutDirection(argumentList.argument)) {
    return [argumentList.argument.name];
  } else {
    return [];
  }
};

function Service(serviceInfo, deviceInfo, connectionInfo) {
  this.meta = serviceInfo;
  this.deviceInfo = deviceInfo;
  this.connectionInfo = connectionInfo;
  this.actions = {};
  this.actionsInfo = {};
  this.stateVariables = {};
}

Service.prototype.subscribe = function() {
  return this._sendSubscriptionRequest();
};

Service.prototype.initialize = function() {
  var that = this;
  return new Promise(function(resolve, reject) {
    var url = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + that.meta.SCPDURL;
    request({
      url: url,
      rejectUnauthorized: false
    }, function(error, response, body) {
      if(!error && response.statusCode == 200) {
        parseString(body,
          {
            explicitArray: false
          }, function (err, result) {
            if(!err) {
              that._parseActions(result.scpd.actionList);
              that._parseStateVariables(result.scpd.serviceStateTable);
              resolve();
            } else {
              reject(err);
            }
        });
      } else {
        reject(error);
      }
    });
  });
};

Service.prototype._parseActions = function (actionList) {
  var that = this;
  if(Array.isArray(actionList.action)) {
    actionList.action.forEach(function(action) {

      //Create meta informations
      that.actionsInfo[action.name] = {};
      that.actionsInfo[action.name].inArgs = getInArguments(action.argumentList);
      that.actionsInfo[action.name].outArgs = getOutArguments(action.argumentList);

      //Bind action
      that.actions[action.name] = function(vars) {
        vars = vars ? vars : [];
        return that._sendSOAPActionRequest(
          that.device,
          that.meta.controlURL,
          that.meta.serviceType,
          action.name,
          that.actionsInfo[action.name].inArgs,
          that.actionsInfo[action.name].outArgs,
          vars);
      };
    });
  }
};

Service.prototype._parseStateVariables = function(serviceStateTable) {
  var that = this;
  if(serviceStateTable.stateVariable && Array.isArray(serviceStateTable.stateVariable)) {
    serviceStateTable.stateVariable.filter(sendsEvents).forEach(function(stateVariable) {
      that.stateVariables[stateVariable.name] = stateVariable;
      delete stateVariable.$;
    });
  }
};

var buildSoapMessage = function(action, serviceType, vars) {
  var fqaction = 'u:'+action;
  var root = {
    's:Envelope': {
      '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
      '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
      's:Body': {}
    }
  };
  root['s:Envelope']['s:Body'][fqaction] = {
    '@xmlns:u': serviceType
  };
  _.extend(root['s:Envelope']['s:Body'][fqaction], vars);
  var xml = xmlbuilder.create(root);
  return xml.end();
};

Service.prototype._sendSubscriptionRequest = function () {
  var that = this;

  return new Promise(function(resolve, reject) {

    var uri = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + that.meta.eventSubURL;

    request({
        method: 'SUBSCRIBE',
        uri: uri,
        auth: that.connectionInfo.auth,
        rejectUnauthorized: false,
        headers: {
          'CALLBACK': "<http://" + that.connectionInfo.serverAddress + ':' + that.connectionInfo.serverPort + ">",
          'NT': 'upnp:event',
          'TIMEOUT': 'Second-infinite'
        }
    }, function(error, response, body) {
      if(!error && response.statusCode == 200) {
        resolve(response.headers.sid);
      } else if (!error && response.statusCode !== 200) {
        reject(response.statusCode+": "+response.statusMessage);
      } else {
        reject(error);
      }
    });
  });
};

Service.prototype._sendSOAPActionRequest = function (device, url, serviceType, action, inArguments, outArguments, vars) {
  var that = this;
  return new Promise(function(resolve, reject) {

    var body = buildSoapMessage(action, serviceType, vars);
    var agentOptions = null;

    var uri = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + url;

    request({
        method: 'POST',
        uri: uri,
        auth: that.connectionInfo.auth,
        agentOptions: agentOptions,
        rejectUnauthorized: false,
        headers: {
            "SoapAction": serviceType + "#" + action,
            "Content-Type": "text/xml; charset=\"utf-8\""
        },
        body: body
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            parseString(body, {
                explicitArray: false
            }, function (err, result) {
                var challange = false;
                var res = {};
                var env = result['s:Envelope'];
                if (env['s:Body']) {
                    var body = env['s:Body'];
                    if (body['u:' + action + 'Response']) {
                        var responseVars = body['u:' + action + 'Response'];
                        if (outArguments) {
                            outArguments.forEach(function (arg) {
                                res[arg] = responseVars[arg];
                            });
                        }
                    } else if (body["s:Fault"]) {
                        var fault = body["s:Fault"];
                        error = new Error("Device responded with fault " + error);
                        res = fault;
                    }
                }
                resolve(res);
            });
        } else if (!error && response.statusCode !== 200) {
          reject(response.statusCode+": "+response.statusMessage);
        } else {
          reject(error);
        }
    });
  });
};

exports.Service = Service;
