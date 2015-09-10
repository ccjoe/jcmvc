var http = require('http');

var req = module.exports = {
    __proto__: http.IncomingMessage.prototype
};