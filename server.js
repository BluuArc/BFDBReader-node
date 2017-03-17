var fs = require('fs');

//on-going database that is a combination of 3 other databases (GL,EU,JP)
var master_list = {
    unit: null,
    item: null,
    load: load_database()
};

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

//load database from a file or files
function load_database(){
    //open unit
    var global = synchr_json_load('info-gl.json');
    var japan = synchr_json_load('info-jp.json');
    var europe = synchr_json_load('info-eu.json');
    master_list.unit = global;
    // merge_databases(master_list.unit, japan);
    // merge_databases(master_list.unit, europe);

    //open item
}




