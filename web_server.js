//for file management
var fs = require('fs');
var request = require('request');
var rp = require('request-promise');

var _ = require('lodash'); //for search functions
// var translate = require('google-translate-api');

//for memory management
var heapdump = require('heapdump');

//for server setup 
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();

let common = require('./server_modules/bfdb_common.js');

//to add a module, simply add the name and associated require here
let db = {
    units: require('./server_modules/unit.js'),
    items: require('./server_modules/item.js'),
    es: require('./server_modules/es.js'),
    bbs: require('./server_modules/bb.js'),
};

let isReloading = true;

//for command line
var argv = require('yargs')
    .usage('Usage: $0 -p [integer] -i [string of IP address] -r -n -t')
    .default("p", 8081)
    .default("i", '127.0.0.1')
    .alias('p', 'port')
    .alias('i', 'ip').alias('i', 'ip-address')
    .alias('r', 'reload').alias('r', 'refresh')
    .alias('n', 'notranslate')
    .alias('t', 'test_function')
    .describe('p', 'Port to run server on')
    .describe('i', 'IP Address to run server on')
    .describe('r', 'Force a redownload of the database. Use this if you have issues with the JSON files.')
    .describe('n', 'Disable translation (for testing)')
    .describe('t', 'Run test function')
    .help('h')
    .alias('h', 'help')
    .argv;

//source: http://stackoverflow.com/questions/7067966/how-to-allow-cors
//CORS middleware, required for cross-domain reqeusting
var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
};

app.use(compression());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(allowCrossDomain);


function init_db(isReload){
    //make sure all known evo mats are in English
    function translate_evo_mats(unit_db, item_db) {
        //for every unit with an evolution
        for (let unit in unit_db) {
            let curUnit = unit_db[unit];
            if (curUnit.evo_mats !== undefined) {
                //for every evo mat
                for (let m = 0; m < curUnit.evo_mats.length; ++m) {
                    let curMat = curUnit.evo_mats[m];
                    //use names currently available in database
                    if (curMat.type === "unit" && unit_db[curMat.id] !== undefined) {
                        unit_db[unit].evo_mats[m].name = unit_db[curMat.id].name;
                    } else if (curMat.type === "item" && item_db[curMat.id] !== undefined) {
                        unit_db[unit].evo_mats[m].name = item_db[curMat.id].name;
                    }
                }
            }
        }
    }

    //remove ES ties to units
    function trim_es_db(unit_db,es_db){
        let presentIDs = ((unit_db) => {
            var ids = [];
            //get all ES IDs
            for (let u in unit_db) {
                if (unit_db[u]["extra skill"])
                    ids.push(parseInt(unit_db[u]["extra skill"].id));
            }

            //sort for easier searching
            ids.sort(function (a, b) {
                return a - b;
            });
            return ids;
        })(unit_db);
        for (let e in es_db) {
            // console.log(e);
            //remove ES already in in main unit DB
            if (_.sortedIndexOf(presentIDs, parseInt(e)) > -1) {
                delete es_db[e];
                // console.log("Removing ES",e);
            }
        }
    }

    function trim_bbs_db(unit_db,bb_db){
        let presentIDs = [];
        for(let u in unit_db){
            let curUnit = unit_db[u];
            if(curUnit.bb){
                presentIDs.push(parseInt(curUnit.bb.id));
            }
            if(curUnit.sbb){
                presentIDs.push(parseInt(curUnit.sbb.id));
            }
            if(curUnit.ubb){
                presentIDs.push(parseInt(curUnit.ubb.id));
            }
        }

        //sort in ascending order
        presentIDs.sort(function(a,b){
            return a - b;
        });

        for(let b in bb_db){
            if(_.sortedIndexOf(presentIDs,parseInt(b)) > -1){
                delete bb_db[b];
            }
        }
    }

    let loadRequests = Object.keys(db);

    return common.do_n_at_a_time(loadRequests,1,(r) => {
        if(!isReload){
            return db[r].init();
        }else{
            return db[r].reload();
        }
    }).then(() => {
            //post processing
            console.log("Doing some post processing of DBs...");
            translate_evo_mats(db.units.getDB(),db.items.getDB());
            trim_es_db(db.units.getDB(),db.es.getDB());
            trim_bbs_db(db.units.getDB(),db.bbs.getDB());
            return;
        }).then(() => {
            let translations = [];
            for(let d in db){
                db[d].update_statistics();
            }

            if(!argv.notranslate){
                return common.do_n_at_a_time(loadRequests,1,(r) => {
                    if(r !== "bbs"){
                        return db[r].translate();
                    }else{
                        return; //don't translate BBs
                    }
                },true);
            }else{
                return;
            }
        }).then(() => {
            isReloading = false;  
        });
}

function reload_db(){
    let reloadRequests = Object.keys(db);
    isReloading = true;

    return common.do_n_at_a_time(reloadRequests,1,(db_name) => {
        return db[db_name].download();
    },true).then(() => {
        return init_db(true).then(send_updates);
    }).then(() => {
        init_memory_fix();
        return;  
    });
}

function get_stats(){
    let temp_stats = {
        gl: {},
        jp: {},
        eu: {}
    };
    let servers = ['gl','jp','eu'];
    for(let d in db){
        let curStats = db[d].getStats();
        for(let s of servers){
            temp_stats[s][`num_${d}`] = curStats[s].total_entries;
            temp_stats[s][`newest_${d}`] = curStats[s].newest;
        }
    }
    return temp_stats;
}

//send database statistics to Discord webhooks
function send_updates() {
    function create_sectional_messages(data_arr, msg_len, acc_limit) {
        var msg_arr = [];
        var curMsg = "";
        var local_data = data_arr.slice();
        while (local_data.length > 0) {
            //reached max limit, push and continue
            if (curMsg.length + local_data[0].length > msg_len) {
                if (msg_arr.length === acc_limit - 1) {
                    curMsg += `...and ${local_data.length} more.`;
                    msg_arr.push(curMsg);
                    curMsg = "";
                    break;
                } else {
                    msg_arr.push(curMsg);
                    curMsg = "";
                }
            } else { //keep adding to curMsg
                curMsg += local_data.shift();
            }
        }

        if (curMsg.length > 0) {
            msg_arr.push(curMsg);
        }

        return msg_arr;
    }
    //given a server name (GL,EU,JP) and type (Units or Items)
    //return an array of field objects with keys title and value
    function get_server_statistics(stats, server_name, type) {
        var newest = stats[`newest_${type.toLowerCase()}`];
        var field_title = `${server_name} Server - ${type}`;
        var msg = `${server_name} has ` + stats[`num_${type.toLowerCase()}`] + ` ${type}. `;
        if (newest.length > 0 && newest.length !== stats[`num_${type.toLowerCase()}`]) {
            msg += `The ${newest.length} new ${type.toLowerCase()} are:\n`;
        } else {
            msg += `There are ${newest.length} new ${type.toLowerCase()}.`;
            return [
                {
                    title: field_title,
                    value: msg
                }
            ];
        }

        var parsed_newest = [];
        if (type === "Units") {
            for (let u = 0; u < newest.length; ++u) {
                let curUnit = db.units.getByID([newest[u]]);
                let name = (curUnit.translated_name) ? curUnit.translated_name : curUnit.name;
                parsed_newest.push(`${name} (${curUnit.id})\n`);
            }
        } else if (type === "Items") {
            for (let i = 0; i < newest.length; ++i) {
                let curItem = db.items.getByID([newest[i]]);
                let name = (curItem.translated_name) ? curItem.translated_name : curItem.name;
                parsed_newest.push(`${name} (${curItem.id})\n`);
            }
        } else if (type === "ES") {
            for (let i = 0; i < newest.length; ++i) {
                let curES = db.es.getByID([newest[i]]);
                let name = (curES.translated_name) ? curES.translated_name : curES.name;
                parsed_newest.push(`${name} (${curES.id})\n`);
            }
        } else {
            msg += "Error: Unknown type " + type;
            return [
                {
                    title: field_title,
                    value: msg
                }
            ];
        }


        var msg_arr = create_sectional_messages(parsed_newest, 900, 5);
        var field_arr = [
            {
                title: `${field_title} - 1`,
                value: msg + msg_arr[0]
            }
        ];

        for (let m = 1; m < msg_arr.length; ++m) {
            field_arr.push({
                title: `${field_title} - ${m + 1}`,
                value: msg_arr[m]
            });
        }
        return field_arr;
    }

    //create payload for discord webhook
    function create_update_payload() {
        var mapping = {
            gl: "Global",
            jp: "Japan",
            eu: "Europe"
        }

        let stats = get_stats();

        var types = ["Units", "Items", "ES"];

        var fields = [];
        for (let m in mapping) {
            for (let t of types) {
                fields.push(get_server_statistics(stats[m], mapping[m], t));
            }
        }

        var payload = {
            username: "Bluubot DB Update",
            text: "This message is sent whenever the database server for Bluubot is updated",
            attachments: [
                {
                    color: '#3498DB',
                    fields: [
                    ]
                }
            ]
        };

        for (let f = 0; f < fields.length; ++f) {
            for (let m = 0; m < fields[f].length; ++m) {
                payload.attachments[0].fields.push(fields[f][m]);
            }
        }

        console.log(JSON.stringify(payload, null, 2));
        return payload;
    }

    function send_webhook_post(url, payload) {
        var send_options = {
            method: "POST",
            uri: url,
            json: payload
        };
        // console.log("Would've sent payload to",url);
        // return;
        return rp(send_options)
            .then(function (result) {
                console.log("Successfully sent to " + url);
            }).catch(function (err) {
                console.log(err);
                console.log("Error with " + url);
            });
    }
    var webhooks;
    try {
        webhooks = fs.readFileSync('./webhooks.txt', 'utf8');
        //clean input
        while (webhooks.indexOf('\r') > -1) {
            webhooks = webhooks.replace('\r', '\n');
        }
        webhooks = webhooks.split('\n');
    } catch (err) {
        console.log(err);
        return;
    }

    console.log("Webhook found:", webhooks);
    var payload = create_update_payload();
    var promises = [];
    for (var i = 0; i < webhooks.length; ++i) {
        if (webhooks[i].length > 0) {
            console.log("Sending payload to " + webhooks[i]);
            promises.push(send_webhook_post(webhooks[i] + "/slack", payload));
        }
    }

    return Promise.all(promises);
}

//this somehow cleans up the extra memory after the first init
function init_memory_fix(){
    console.log("Starting heapdump");
    heapdump.writeSnapshot(function (err, filename) {
        console.log('dump written to', filename);
        fs.unlinkSync(`./${filename}`);
        console.log("deleted",filename);
    });
}

app.get('/', function (request, response) {
    response.end("<h1>Hello World</h1>");

    //manual trigger
    init_memory_fix();
});

//show the statistics of the server
app.get('/status', function (request, response) {
    response.end(JSON.stringify(get_stats()));
});

app.get('/reload',function(request,response){
    // let query = request.query; //TODO: password protect this function
    if(!isReloading){
        reload_db();
        response.end("Started reloading process");
    }else{
        response.end("Reload is already in progress");
    }
});

let create_db_accessors = {
    getByID: (url_name,db_name) => {
        app.get(`/${url_name}/:id`,function(request,response){
            let id = request.params.id.toString();
            response.end(JSON.stringify(db[db_name].getByID(id)));
        });
    },
    search: (url_name, db_name) => {
        app.get(`/search/${url_name}/options`,function(request,response){
            let query = request.query;
            response.end(JSON.stringify(db[db_name].search(query)));
        });
    },
    list: (url_name, db_name) => {
        app.get(`/list/${url_name}`,function(request,response){
            let query = request.query;
            response.end(JSON.stringify(db[db_name].list(query)));
        })
    }
}

function createListeners(){
    let noChangeFields = ['es'];
    for (let d in db) {
        let target = (noChangeFields.indexOf(d) === -1) ? d.slice(0, d.length - 1) : d;
        console.log("Creating listeners for", target);
        create_db_accessors.getByID(target,d);
        create_db_accessors.search(target,d);
        create_db_accessors.list(d,d);
    }
}


let loadPromise;
if (argv.reload) {
    loadPromise = reload_db();
} else {
    loadPromise = init_db();
}
loadPromise.then(() => {
    // console.log("Done loading");
    return new Promise(function(fulfill,reject){
        createListeners();
        init_memory_fix();

        var server = app.listen(argv.port, argv.ip, function () {
            let host = server.address().address;
            let port = server.address().port;

            console.log("Finished loading database");
            console.log("Ready! Server listening at http://%s:%s", host, port);
            
            fulfill(); //necessary to only enter test function after this message
        });
    });
}).catch(function (err) {
    console.log(err);
    console.log("Exiting...");
    process.exit();
}).then(function () {
    if (argv.test_function)
        test_function();
});

function test_function() {
    console.log("Entered test function");

    heapdump.writeSnapshot(function (err, filename) {
        console.log('dump written to', filename);
    });
    console.log("Done");
}