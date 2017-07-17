let fs = require('fs');
let common = require('./bfdb_common.js');

//general constructor for any db used in the main server
let DBModule = function(options){
    /* options = {
        name: name of module
        files: [
            {
                name: name of current object
                files: [
                    {name: dbname1, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
                    {name: dbname2, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
                    ...
                    ],
                setupFn: (db, loaded_files, name) => {
                    loaded_files is JSON object keyed by names in files array and contains file contents
                    code to combine the files with the db object goes here
                    not expected to return anything
                }
            },
        ]
        
        search: function(query,db)
        getByID: funtion(id,db)
        translate: {
            needsTranslation(entry) //input is a single entry in the db, output is true/false
            translate(entry) //translate the entry; returns a promise; not expected to return anything in promise as it's expected to modify the object directly
            max_translations: max number of translations at a time
        }
    }
    */
    options = options || {};
    let db;
    let stats;
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
    //promise function is expected to receive the object at an array index
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
        console.log(`Deleting old db for ${name}...`);
        let keys = Object.keys(db);
        for(let k of keys){
            delete db[k];
        }
        console.log("Begin reloading files for",name);
        return init();
    }
    this.reload = reload;

    /*
        files: [
            { 
                name: name of current object
                files: [
                    {name: dbname1, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
                    {name: dbname2, main: mainfile.json, alternatives: [alt1.json, alt2.json,...]},
                    ...
                    ], 
                setupFn: (db, loaded_files, name) => { 
                    code to combine the files with the db object;
                    doesn't return anything
                }
            },
        ]
    */
    //load each set of files and merge into db one by one
    function init(){
        function single_load(file_obj){
            let file_db = {};
            let file_promises = [];
            return new Promise(function(fulfill,reject){
                for(let f of file_obj.files){
                    let curPromise = load_json_promisified(f.main,f.alternatives)
                        .then(function(result){
                            file_db[f.name] = result;
                            return;
                        }); 
                    file_promises.push(curPromise);
                }

                Promise.all(file_promises).then(function(){
                    return Promise.resolve(file_obj.setupFn(db,file_db,file_obj.name));
                }).then(fulfill).catch(reject);
            });
        }
        if (!options.files) throw new Error("No files specified");
        let files = options.files.slice();
        //ensure setupFn is valid for all files
        for(let f of files){
            if(typeof f.setupFn !== "function"){
                throw new Error(`No proper setupFn specified for ${f.name}`);
            }
        }
        db = {};

        return do_n_at_a_time(files,1,single_load);
    }
    this.init = init;

    this.getDB = () => { return db; };
    this.getStats = () => { return stats; };

    function search(query){
        if(typeof options.search !== "function"){
            throw new Error("No search function defined");
        }else{
            return options.search(query,db);
        }
    }
    this.search = search;

    function getByID(id){
        if(typeof options.getByID !== "function"){
            return db[id];
        }else{
            return options.getByID(id,db);
        }
    }
    this.getByID = getByID;

    function translate_db(){
        if(typeof options.translate !== "object" || typeof options.translate.needsTranslation !== "function" || typeof options.translate.translate !== "function"){
            console.log(options, typeof options.translate , typeof options.translate.needsTranslation , typeof options.translate.translate);
            throw new Error("Must specify options.translate.needsTranslation and options.translate.translate to use this function");
        }
        let to_be_translated = [];
        let count_finished = 0;
        for(let entry in db){
            if(options.translate.needsTranslation(db[entry])){
                to_be_translated.push(db[entry]);
            }
        }

        console.log(`Translating ${to_be_translated.length} entries in ${name}`);

        let translate = (entry) => {
            return options.translate.translate(entry)
                .then( () => {console.log(`Translated ${++count_finished}/${to_be_translated.length} entries in ${name}`);});
        }

        return do_n_at_a_time(to_be_translated, options.translate.max_translations || 5,translate);
    }
    this.translate = translate_db;

    function update_statistics(){
        if(typeof options.update_statistics !== "function"){
            throw new Error("Must specify options.update_statistics function");
        }else{
            if(stats){
                let keys = Object.keys(stats);
                for(let k of keys){
                    delete stats[k];
                }
                stats = {};
            }
            stats = options.update_statistics(db);
        }
    }
    this.update_statistics = update_statistics;

    function list(query){
        if(options.list && (typeof options.list.getEntry !== "function" || typeof options.list.filter !== "function")){
            throw new Error("Must specify options.list object fully");
        }
        let listTarget = options.list || {};

        if(query.verbose){
            console.log(query);
        }

        let getEntry = listTarget.getEntry || ((target) => {
            let name = target.translated_name || target.name || target.desc;
            return {
                id: parseInt(target.id),
                name: `${name} (${target.id})`
            };
        });

        let list = [];
        for(let t in db){
            let target = db[t];
            list.push(getEntry(target));
        }

        let filterFn = listTarget.filter || common.listFilter;

        return filterFn(query,list);
    }
    this.list = list;
};

module.exports = DBModule;