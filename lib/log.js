var chalk = require('chalk'),
    colors = ['magenta', 'green', 'blue', 'grey', 'yellow'],
    widths = [20, 24, 18, 0, 0];

var types = {
	info : chalk.bgGreen.white,
	log  : chalk.bgBlue.white,
	warn : chalk.bgYellow.black,
	error: chalk.bold.underline.red
};

var log = {};

log.column = function() {
    var args = [].map.call(arguments, function(val, i) {
        val = typeof val === 'object' ? JSON.stringify(val) : val;
        val = width(val, widths[i]);
        val = chalk[colors[i]](val);

        return val;
    });
    console.log.apply(null, args);
};

for(var type in types){
	(function(t) {
		log[t] =  function(){
			var args = [].map.call(arguments, function(val, i) {
		        val = typeof val === 'object' ? JSON.stringify(val) : val;
		        val = types[t](val);
		        return val;
		    });
			console.log.apply(null, args);
		};
	})(type);
}

function width(str, count) {
    if (str.length < count) {
        str += new Array(count - str.length).join(' ');
    }
    return str;
}

module.exports = log;