//Database: PostgreSQL
//Host: ec2-23-21-249-224.compute-1.amazonaws.com
//User: fkyrspabeqortn
//Password: Eyj_zb0WJ8hXLSA_wSJeykCMNz
//Port: 5432
//URL: postgres://fkyrspabeqortn:Eyj_zb0WJ8hXLSA_wSJeykCMNz@ec2-23-21-249-224.compute-1.amazonaws.com:5432/d9undrb8iddcgc

var http = require("http");
var pg = require('pg');

http.createServer(function(request, response) {
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write("Hello World");
    response.end();

    console.log("I am working");
}).listen(process.env.PORT || 443);

var process_token = process.env.token;
if (!process_token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');
var schedule = require('node-schedule');

var controller = Botkit.slackbot({
    debug: false
});

var bot = controller.spawn({
    token: process_token
}).startRTM();

function user_list(cb) {
    bot.api.users.list({token: process_token}, function (err, json) {
        cb(json.members)
    });
}

function im_list(cb) {
    bot.api.im.list({token: process_token}, function (err, json) {
        cb(json.ims);
    });
}


function user_id(username, cb) {
    user_list(function (userlist) {
        userlist.forEach(function (element, i, arr) {
            if (element.name == username) {
                cb(element.id);
            }
        });
    });
}

function im_id(userid, cb) {
    im_list(function (imlist) {
        var found = false;
        imlist.forEach(function (element, index, array) {
            if (element.user == userid) {
                cb(element.id);
                found = true;
            }
        });
        if (!found) {
            bot.api.im.open({token: process_token, user: userid}, function (err, json) {
                if (!err) {
                    cb(json.channel.id)
                }
            })
        }
    });
}


var users = [];

function direct_message(user_name, message) {
    user_id(user_name, function (userid) {
        im_id(userid, function(imid) {
            controller.startConversation(bot, {
                text: '',
                user: userid,
                channel: imid
            }, function (err, convo) {
                convo.say(message);
            });
        })
    });
}

function broadcast_to_team(message) {
    users.forEach(function (user, i, arr) {
        direct_message(user.name, message);
    })
}

function recurring_task(days, hour, minute, fun) {
    var rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = days;
    rule.hour = hour;
    rule.minute = minute;

    schedule.scheduleJob(rule, function () {
        fun()
    })
}

function schedule_team_reminder (days, hour, minute, message) {
    recurring_task(days, hour, minute, function () {
        broadcast_to_team(message)
    })
}

function flag_owner() { //user with minimal flag_order
    return users.reduce(function (res, user) {
        if (user.flag_order) {
            if (res) {
                if (res.flag_order > user.flag_order) {
                    return user;
                }
            } else {
                return user;
            }
        }
        return res;
    }, undefined).name;
}

function seminar_owner() { //the user with minimal seminar_order
    return users.reduce(function (res, user) {
        if (user.seminar_order) {
            if (res) {
                if (res.seminar_order > user.seminar_order) {
                    return user;
                }
            } else {
                return user;
            }
        }
        return res;
    }, undefined).name;
}

function update_seminar_order() {
    var owner = seminar_owner();
    var max = users.reduce(function (max, user) {
        if (user.seminar_order) {
            if (user.seminar_order > max) {
                return user.seminar_order;
            }
        }
        return max;
    }, 0);

    for (var i = 0; i < users.length; i++) {
        if (users[i].name == owner) {
            users[i].seminar_order = max + 1;
        }
    }

    pg.connect("postgres://fkyrspabeqortn:Eyj_zb0WJ8hXLSA_wSJeykCMNz@ec2-23-21-249-224.compute-1.amazonaws.com:5432/d9undrb8iddcgc", function(err, client) {
        if (err) throw err;
        client.query("UPDATE users SET seminar_order = " + (max + 1) + " WHERE name = '" + owner + "';")
            .on('row', function(row) {
            });
    });
}

function update_flag_order() {
    var owner = flag_owner();
    var max = users.reduce(function (max, user) {
        if (user.flag_order) {
            if (user.flag_order > max) {
                return user.flag_order;
            }
        }
        return max;
    }, 0);

    for (var i = 0; i < users.length; i++) {
        if (users[i].name == owner) {
            users[i].flag_order = max + 1;
        }
    }

    pg.connect("postgres://fkyrspabeqortn:Eyj_zb0WJ8hXLSA_wSJeykCMNz@ec2-23-21-249-224.compute-1.amazonaws.com:5432/d9undrb8iddcgc", function(err, client) {
        if (err) throw err;
        client.query("UPDATE users SET flag_order = " + (max + 1) + " WHERE name = '" + owner + "';")
            .on('row', function(row) {
            });
    });
}

function notify_flag_owner(reason) {
    direct_message(flag_owner(), reason + " You are flag owner for now.");
}

controller.hears(['uptime'],'direct_message,direct_mention,mention',function(bot,message) {

    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,'I have been running for ' + uptime + ' on ' + hostname + ". " +
      "Host time: " + new Date().toString());

});

controller.hears(['flag owner'],'direct_message,direct_mention,mention',function(bot,message) {
    bot.reply(message,'Flag owner is ' + flag_owner() + ".");
});

controller.hears(['seminar owner'],'direct_message,direct_mention,mention',function(bot,message) {
    bot.reply(message,'Seminar owner is ' + seminar_owner() + ".");
});

controller.hears(['users'],'direct_message,direct_mention,mention',function(bot,message) {
    bot.reply(message,'All users database: ');
    users.forEach(function (user, index, array) {
        bot.reply(JSON.stringify(user))
    })
});

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit +'s';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

pg.defaults.ssl = true;
pg.connect("postgres://fkyrspabeqortn:Eyj_zb0WJ8hXLSA_wSJeykCMNz@ec2-23-21-249-224.compute-1.amazonaws.com:5432/d9undrb8iddcgc", function(err, client) {
    if (err) throw err;
    console.log('Connected to postgres! Getting schemas...');

    var query = client.query('SELECT name, seminar_order, flag_order FROM users;');
    query.on('row', function(row) {
            var user = row;
            console.log(user);
            users.push(user);
        });

    query.on('end', function () {
        schedule_team_reminder([1, 2, 4, 5], 12, 59, "Daily meeting!");

        schedule_team_reminder([3], 10, 57, "Weekly seminar!");
        recurring_task([3], 10, 57, function () {
            broadcast_to_team("Weekly seminar with " + seminar_owner() + " !");
            update_seminar_order();
        });
        recurring_task([3], 11, 57, function() {
            direct_message(seminar_owner(), "You are the next seminar owner!");
        });
        recurring_task([1], 10, 57, function () {
            direct_message(seminar_owner(), "Two days left before your seminar...");
        });

        recurring_task([1], 6, 6, function () {
            notify_flag_owner("The week just started.");
        });
        recurring_task([2, 3, 4, 5], 6, 6, function () {
            notify_flag_owner("The day just started.");
        });
        recurring_task([6], 6, 6, function () {
            update_flag_order();
        })
    });
});
