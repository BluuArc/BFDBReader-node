var fs = require('fs');
var underscore = require('underscore');
var compression = require('compression');
var bodyParser = require('body-parser');
var express = require('express'),
    app = express();

app.use(compression());
app.use(bodyParser.urlencoded({extended: false}));

//on-going database that is a combination of 3 other databases (GL,EU,JP)
var master_list = {
    unit: {},
    item: {},
};

//asynchronous file load, used for updating after database is built
function asynchr_json_load(file, callbackFn){
    console.log("opening " + __dirname + "/" + file);
    fs.readFile(__dirname + "/" + file, 'utf8', function(err,data){
        if(err){
            console.log(err);
            callbackFn(null);
        }
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
        console.log("Saved " + file);
        return;
    });
}

//add in anything in db_sub that is not in db_main
function merge_databases(db_main, db_sub, server){
    var local_obj = JSON.parse(JSON.stringify(db_main)); //casting
    for(unit in db_sub){ //iterate through everything in object
        if(local_obj[unit] != undefined){ //exists, so just add date add time
            if(local_obj[unit]["server"].indexOf(server) == -1){
                local_obj[unit]["server"].push(server);
                local_obj[unit]["db_add_time"].push(new Date().toUTCString());
            }
        }else{ //doesn't exist, so add it and date add time
            local_obj[unit] = db_sub[unit];
            local_obj[unit].server = [server];
            local_obj[unit]["db_add_time"] = [new Date().toUTCString()];
        }
    }
    return local_obj;
}

//adds sp section in in the sub database to the main database
function add_sp_to_db(db_main, db_sub){
    // var local_obj = JSON.parse(JSON.stringify(db_main)); //casting
    for(unit in db_sub){
        db_main[unit]["skills"] = db_sub[unit]["skills"];
    }
}

//load database from a file or files
function load_database(master_obj){
    master_obj["unit"] = {};
    //open unit
    try{
        console.log("Loading master unit database...");
        master_obj["unit"] = synchr_json_load('info-master.json');
    }catch(err){ 
        console.log("Master database not found. Loading individual unit databases...");
        var global = synchr_json_load('info-gl.json');
        var global_sp = synchr_json_load('feskills-gl.json');
        var japan = synchr_json_load('info-jp.json');
        var japan_sp = synchr_json_load('feskills-jp.json');
        var europe = synchr_json_load('info-eu.json');
        //add sp skills to respective databases
        add_sp_to_db(global,global_sp);
        add_sp_to_db(japan,japan_sp);
        console.log("Merging unit databases...");
        master_obj["unit"] = merge_databases(master_obj.unit, global, 'gl');
        master_obj["unit"] = merge_databases(master_obj.unit, europe, 'eu');
        master_obj["unit"] = merge_databases(master_obj.unit, japan, 'jp');
        //TODO: Add creation of smaller JSON file of BFDBReader-node specific additions (e.g. add time and server)
        asynchr_json_write('info-master.json', JSON.stringify(master_obj["unit"]));
    }

    //open item
}

app.get('/', function(request, response){
    response.end("<h1>Hello World</h1>");
});

app.get('/unit/:id', function(request, response){
    var unit = master_list.unit[request.params.id];
    if(unit == undefined)  
        response.end(JSON.stringify({error: request.params.id + " is not found"}));
    else
        response.end(JSON.stringify(master_list.unit[request.params.id]));
});

app.get('/search', function(request,response){
    response.sendFile(__dirname + "/" + "search.html");
});

function safe_json_get(value){
     return (value != undefined) ? value : "";
}

//get the corresponding unit value of a given query
function get_query_value(queryField, unit){
    try{
        switch(queryField){
            case 'unit_name_id': return unit["guide_id"] + ": " + unit["name"].toLowerCase() + " (" + unit["id"]+")";
            case 'rarity': return unit["rarity"].toString();
            case 'element': return unit["element"].toLowerCase();
            case 'gender': return unit["gender"].toLowerCase();
            case 'move_speed': return unit["movement"]["skill"]["move speed type"].toLowerCase();
            case 'ls_name': return (unit["leader skill"]["name"] + " - " + unit["leader skill"]["desc"]).toLowerCase();
            case 'ls_effect': return JSON.stringify(unit["leader skill"]["effects"]);
            case 'bb_name': return (unit["bb"]["name"] + " - " + unit["bb"]["desc"]).toLowerCase();
            case 'bb_effect': return JSON.stringify(unit["bb"]["levels"][9]["effects"]);
            case 'sbb_name': return (unit["sbb"]["name"] + " - " + unit["sbb"]["desc"]).toLowerCase();
            case 'sbb_effect': return JSON.stringify(unit["sbb"]["levels"][9]["effects"]);
            case 'ubb_name': return (unit["ubb"]["name"] + " - " + unit["ubb"]["desc"]).toLowerCase();
            case 'ubb_effect': return JSON.stringify(unit["ubb"]["levels"][9]["effects"]);
            case 'es_name': return (unit["extra skill"]["name"] + " - " + unit["extra skill"]["desc"]).toLowerCase();
            case 'es_effect': return JSON.stringify(unit["extra skill"]["effects"]);
            case 'sp_name':
                var result = "";
                for(sp in unit["skills"]){
                    result += unit["skills"][sp]["skill"]["desc"] + "\n";
                }
                return result;
            case 'sp_effect':
                var result = "";
                for (sp in unit["skills"]) {
                    result += JSON.stringify(unit["skills"][sp]["skill"]["effects"]) + "\n";
                }
                return result;
            default: return "";
        }
    }catch(err){
        // console.log(err);
        return "";
    }
}

app.get('/search/options', function(request,response){
    // console.log(request.query);
    var query = request.query;
    for(q in query){
        var curQuery = query[q].toLowerCase();
        //wildcard queries
        if  (curQuery == '' || (q == 'element' && curQuery == 'any') ||
            (q == 'gender' && curQuery == 'any')){
                continue;
        }

        var uValue = get_query_value(q, master_list.unit["10017"]);
        console.log(q + ": " + uValue);
    }
    // console.log("\n\n" + master_list.unit["10017"]);
    response.end("Received request");
})

var server = app.listen(8081, '127.0.0.1', function(){
    var host = server.address().address;
    var port = server.address().port;

    load_database(master_list);

    console.log("Server listening at http://%s:%s", host, port);
});
