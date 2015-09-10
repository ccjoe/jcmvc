var http = require('http');

var res = module.exports = {
    __proto__: http.ServerResponse.prototype
};


res.redirect = function(path) {
    // this.statusCode = 302;
    this.writeHead(302, {
        'Location': path
    });
    return this.end();
};

res.json = function json(obj) {
  var body = JSON.stringify(obj);
  this.setHeader('Content-Type', 'application/json');
  return this.end(body);
};
