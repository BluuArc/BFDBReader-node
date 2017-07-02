var fs = require('fs');

//general constructor for any db used in the main server
let DBModule = function(options){
    /* options = {
        files: [ //files to load
            {name: dbname1, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
            {name: dbname2, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
            ...
        ],
        setupFn: function(results) //input JSON object keyed by the names in files array, output is a promise that has db object keyed by ID
    }
    */
    options = options || {};
    let db;
    let name = options.name || "Module";

    //attempt to rename a given file, if it exists
    function rename_file_promisified(cur_name, new_name) {
        return new Promise(function (fulfill, reject) {
            fs.readFile("./json/" + cur_name, 'utf8', function (err, data) {
                if (err) {
                    console.log("Couldn't find " + cur_name + " to rename");
                    fulfill(); //file doesn't exist, but that's okay
                } else {
                    fs.writeFile("./json/" + new_name, data, 'utf8', function (err) {
                        if (err) console.log("Couldn't rename " + cur_name + " to " + new_name);
                        else console.log("Renamed " + cur_name + " to " + new_name);
                        fulfill(); //finished trying to rename file
                    });
                }
            });
        });
    }

    function load_json_promisified(file, alternative_files) {
        return new Promise(function (fulfill, reject) {
            //try to load first file
            fs.readFile("./json/" + file, 'utf8', function (err, data) {
                if (err) {
                    //try another file if possible
                    if (alternative_files !== undefined && alternative_files.length > 0) {
                        var new_file = alternative_files.pop();
                        console.log("Couldn't load " + file + ". Trying " + new_file);
                        load_json_promisified(new_file, alternative_files).then(fulfill).catch(reject);
                        return;
                    } else {
                        reject("Error: cannot open " + file + " or its alternatives");
                        return;
                    }
                }
                //return parsed data 
                var result;
                try {
                    result = JSON.parse(data);
                } catch (parseError) {
                    //try another file if possible
                    if (alternative_files !== undefined && alternative_files.length > 0) {
                        var new_file = alternative_files.pop();
                        console.log(parseError, "Couldn't load " + file + ". Trying " + new_file);
                        load_json_promisified(new_file, alternative_files).then(fulfill).catch(reject);
                        return;
                    } else {
                        reject(`${parseError}` + "\nError: cannot open " + file + " or its alternatives");
                        return;
                    }
                }
                if (file.indexOf("-old.json") > -1) {
                    // console.log(file.indexOf("-old.json"));
                    rename_file_promisified(file, file.replace("-old.json", ".json"))
                        .then(function () {
                            console.log("Successfully loaded old file. Renamed old file to current file");
                            fulfill(result);
                        }).catch(reject);
                } else {
                    fulfill(result);
                }
            });
        });
    }

    //run an array against a function that returns a promise n times
    //each function is expected to receive the object at an array index
    function do_n_at_a_time(arr, n, promiseFn) {
        function n_recursive(arr, n, acc, callbackFn) {
            if (arr.length === 0) {
                callbackFn(acc);
            } else {
                var max = (arr.length < n) ? arr.length : n;
                var promises = [];
                for (var i = 0; i < max; ++i) {
                    var curObject = arr.shift();
                    promises.push(promiseFn(curObject));
                }
                Promise.all(promises)
                    .then(function (results) {
                        for (var i = 0; i < results.length; ++i) {
                            acc.push(results[i]);
                        }
                        n_recursive(arr, n, acc, callbackFn);
                    });
            }
        }

        var new_arr = arr.slice();
        return new Promise(function (fulfill, reject) {
            try {
                n_recursive(new_arr, n, [], fulfill);
            } catch (err) {
                reject(err);
            }
        });
    }

    //delete db data then re-initialize db; does NOT download anything
    function reload(){
        //delete first level of DB
        console.log(`Deleting old db for ${name}`);
        let keys = Object.keys(db);
        for(let k of keys){
            delete db[k];
        }
        console.log("DB before reload", db);
        return init();
    }
    this.reload = reload;

    function init(){
        //load required files
        let files = options.files;
        if(!files) throw new Error("No files specified");
        if(!options.setupFn) throw new Error("No setup function specified");
        let wip_db = {};
        let file_promises = [];
        return new Promise(function(fulfill,reject){
            //load files and create temp object keyed by given name
            for(let f of files){
                let curPromise = load_json_promisified(f.main,f.alternatives)
                    .then(function(result){
                        wip_db[f.name] = result;
                    });
                file_promises.push(curPromise);
            }

            //set up data for use in db object
            Promise.all(file_promises).then(function(){
                return Promise.resolve(options.setupFn(wip_db));
            }).then(function(new_db){
                //save database
                db = new_db;
                
                //remove data in wip_db
                let keys = Object.keys(wip_db);
                for(let k of keys){
                    delete wip_db[k];
                }

                fulfill();
            }).catch(reject);
        });
    }
    this.init = init;

    this.getDB = () => { return db; };

};

module.exports = DBModule;