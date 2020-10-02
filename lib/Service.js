var parseString = require('xml2js').parseStringPromise;
var xmlbuilder = require('xmlbuilder');
var _ = require('underscore');
var https = require('https');
var axios = require('axios')

const httpclient = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});


var isInDirection = function (argument) {
  return argument.direction === "in";
};

var isOutDirection = function (argument) {
  return argument.direction === "out";
};

var sendsEvents = function (stateVariable) {
  return stateVariable.$.sendEvents === "yes";
};

var getInArguments = function (argumentList) {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isInDirection).map(function (argument) {
      return argument.name;
    });
  } else if (argumentList && argumentList.argument && isInDirection(argumentList.argument)) {
    return [argumentList.argument.name];
  } else {
    return [];
  }
};

var getOutArguments = function (argumentList) {
  if (argumentList && Array.isArray(argumentList.argument)) {
    return argumentList.argument.filter(isOutDirection).map(function (argument) {
      return argument.name;
    });
  } else if (argumentList && argumentList.argument && isOutDirection(argumentList.argument)) {
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

Service.prototype.subscribe = function () {
  return this._sendSubscriptionRequest();
};

Service.prototype.initialize = function () {
  var that = this;
  var url = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + that.meta.SCPDURL;
  return httpclient.get(url)
    .then(function (response) {
      if (response.status == 200) {
        return parseString(response.data, { explicitArray: false })
      } else {
        throw response.statusText
      }
    })
    .then(function (result) {
      that._parseActions(result.scpd.actionList);
      that._parseStateVariables(result.scpd.serviceStateTable);
    })
};

Service.prototype._parseActions = function (actionList) {
  var that = this;
  if (Array.isArray(actionList.action)) {
    actionList.action.forEach(function (action) {

      //Create meta informations
      that.actionsInfo[action.name] = {};
      that.actionsInfo[action.name].inArgs = getInArguments(action.argumentList);
      that.actionsInfo[action.name].outArgs = getOutArguments(action.argumentList);

      //Bind action
      that.actions[action.name] = function (vars) {
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

Service.prototype._parseStateVariables = function (serviceStateTable) {
  var that = this;
  if (serviceStateTable.stateVariable && Array.isArray(serviceStateTable.stateVariable)) {
    serviceStateTable.stateVariable.filter(sendsEvents).forEach(function (stateVariable) {
      that.stateVariables[stateVariable.name] = stateVariable;
      delete stateVariable.$;
    });
  }
};

var buildSoapMessage = function (action, serviceType, vars) {
  var fqaction = 'u:' + action;
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
  var uri = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + that.meta.eventSubURL;
  return httpclient.request({
    method: 'SUBSCRIBE',
    url: uri,
    auth: that.connectionInfo.auth,
    headers: {
      'CALLBACK': "<http://" + that.connectionInfo.serverAddress + ':' + that.connectionInfo.serverPort + ">",
      'NT': 'upnp:event',
      'TIMEOUT': 'Second-infinite'
    },
    validateStatus: (status) => {
      return status === 200
    }
  })
    .then((response) => {
      return Promise.resolve(response.headers.sid);
    })
};

Service.prototype._sendSOAPActionRequest = function (device, url, serviceType, action, inArguments, outArguments, vars) {
  var that = this;
  var body = buildSoapMessage(action, serviceType, vars);
  var agentOptions = null;
  var uri = that.connectionInfo.protocol + that.connectionInfo.host + ":" + that.connectionInfo.port + url;
  return httpclient.request({
    method: 'POST',
    url: uri,
    auth: that.connectionInfo.auth,
    agentOptions: agentOptions,
    rejectUnauthorized: false,
    headers: {
      "SoapAction": serviceType + "#" + action,
      "Content-Type": "text/xml; charset=\"utf-8\""
    },
    validateStatus: (status) => {
      return status === 200
    },
    data: body
  })
    .then((response) => {
      return parseString(response.data, { explicitArray: false })
    })
    .then((result) => {
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
      return Promise.resolve(res)
    })
}
exports.Service = Service;
