var http = require("http");

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


//todo: move to DB
var scala_team_users = [
    'dmitry.naydanov',
    'nikolay.tropin',
    'mikhail.mutcianko',
    'roman.shein',
    'pavel.fatin',
    'kate.ustyuzhanina',
    'alexandra.vesloguzova',
    'andrew.kozlov',
    'alefas'
];

var flag_owner = 'alefas';
var flag_team = [
    'kate.ustyuzhanina',
    'dmitry.naydanov',
    'nikolay.tropin',
    'alefas',
    'mikhail.mutcianko',
    'roman.shein',
    'pavel.fatin'
];

function update_owner() {
    var first_day = new Date(2016, 1, 8, 6, 5, 0, 0);
    var diff = Date.now() - first_day.getTime();
    var week = 1000 * 60 * 60 * 24 * 7;
    var weeks_num = diff / week | 0;
    flag_owner = flag_team[weeks_num % flag_team.length];
}

update_owner();

function broadcast_to_team(message) {
    scala_team_users.forEach(function (user, i, arr) {
        user_id(user, function (userid) {
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

schedule_team_reminder([1, 2, 4, 5], 12, 59, "Daily meeting!");
schedule_team_reminder([3], 10, 57, "Weekly seminar!");

function notify_flag_owner(reason) {
    user_id(flag_owner, function (userid) {
        im_id(userid, function(imid) {
            controller.startConversation(bot, {
                text: '',
                user: userid,
                channel: imid
            }, function (err, convo) {
                convo.say(reason + " You are flag owner for now.");
            });
        })
    });
}

notify_flag_owner("Server is up.");

recurring_task([1], 6, 6, function () {
    update_owner();
    notify_flag_owner("The week just started.");
});

controller.hears(['uptime'],'direct_message,direct_mention,mention',function(bot,message) {

    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,'I have been running for ' + uptime + ' on ' + hostname + ". " +
      "Host time: " + new Date().toString());

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


