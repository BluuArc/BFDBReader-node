var fs = require('fs');
var underscore = require('underscore');
var compression = require('compression');
var express = require('express'),
    app = express();

app.use(compression())

//asynchronous file load, used for updating after database is built
function asynchr_json_load(file, callbackFn){
    console.log("opening " + __dirname + "/" + file);
    fs.readFile(__dirname + "/" + file, 'utf8', function(err,data){
        if(err){
            console.log(err);
            callbackFn(null);
        }
        // console.log(data);
        callbackFn(JSON.parse(data));
    });
}

//synchronous file load, used for building initial database
function synchr_json_load(file){
    return JSON.parse(fs.readFileSync(__dirname + "/" + file, 'utf8'));
}

//used to save data
function asynchr_json_write(file, data){
    fs.writeFile(__dirname + "/" + file, data, function(err){
        if(err){
            console.log(err);
        }
        return;
    });
}

//add in anything in db_sub that is not in db_main
function merge_databases(db_main, db_sub, server){
    var local_obj = JSON.parse(JSON.stringify(db_main));
    for(o in db_sub){ //iterate through everything in object
        if(local_obj[o] != undefined){ //exists, so just add date add time
            if(local_obj[o]["server"].indexOf(server) == -1){
                local_obj[o]["server"].push(server);
                local_obj[o]["db_add_time"].push(new Date().toUTCString());
            }
        }else{ //doesn't exist, so add it and date add time
            local_obj[o] = db_sub[o];
            local_obj[o].server = [server];
            local_obj[o]["db_add_time"] = [new Date().toUTCString()];
        }
    }
    return local_obj;
}

//load database from a file or files
function load_database(master_obj){
    //open unit
    console.log("Loading individual unit databases...");
    var global = synchr_json_load('info-gl.json');
    var japan = synchr_json_load('info-jp.json');
    var europe = synchr_json_load('info-eu.json');
    console.log("Merging unit databases...")
    master_obj["unit"] = {};
    master_obj["unit"] = merge_databases(master_obj.unit, global, 'gl');
    master_obj["unit"] = merge_databases(master_obj.unit, europe, 'eu');
    master_obj["unit"] = merge_databases(master_obj.unit, japan, 'jp');

    //open item
}

//on-going database that is a combination of 3 other databases (GL,EU,JP)
var master_list = {
    unit: {},
    item: {},
};

load_database(master_list);

for(u in master_list.unit){
    if(master_list.unit[u]["server"].indexOf('jp') > -1)
        for(s in master_list.unit[u]["server"])
            console.log(master_list.unit[u]["name"] + ": Added to " + master_list.unit[u]["server"][s] + " at " + master_list.unit[u]['db_add_time'][s]);
}