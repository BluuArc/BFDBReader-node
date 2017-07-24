let fs = require('fs');
let common = require('./bfdb_common.js');
let request = require('request');

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
    function rename_file_promisified(cur_name,new_name){
        return new Promise(function (fulfill, reject) {
            fs.rename(`./json/${cur_name}`, `./json/${new_name}`, (err) => {
                if (err) {
                    console.log("Couldn't rename " + cur_name + " to " + new_name);
                }else{
                    console.log("Renamed " + cur_name + " to " + new_name);
                }
                fulfill();
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

    //donwnload a single file
    function json_download_promisified(url, local_name) {
        return new Promise(function (fulfill, reject) {
            console.log("DL: " + url + " > " + local_name);
            try {
                fs.mkdirSync('./json/');
            } catch (err) {/*do nothing as directory already exists*/ }

            var destination = fs.createWriteStream(`./json/${local_name}`);
            console.log(destination.path);
            request(url).pipe(destination).on('finish', function () {
                fulfill(local_name);
            });
        });
    }

    //delete db data then re-initialize db; does NOT download anything
    function reload(setup_options){
        //delete first level of DB
        if(db){
            console.log(`Deleting old db for ${name}...`);
            let keys = Object.keys(db);
            for(let k of keys){
                delete db[k];
            }
        }
        console.log("Begin reloading files for",name);
        return init(setup_options);
    }
    this.reload = reload;

    function download(){
        if(!options.files){
            throw new Error("No files specified");
        }
        let downloadLimit = options.downloadLimit || 1;
        let files = [];
        let toRename = [];
        for(let file_obj of options.files){
            for(let file of file_obj.files){
                files.push({
                    filename: file.main,
                    url: file.main_url,
                });
                let fileParts = file.main.split('.');
                let extension = fileParts.pop();
                toRename.push({
                    old_name: file.main,
                    new_name: `${fileParts.join('.')}-old.${extension}`
                });
            }
        }

        console.log("Renaming files");
        let renamedPromise = common.do_n_at_a_time(toRename,1,(f) => {
            return rename_file_promisified(f.old_name,f.new_name);
        },true);
        return renamedPromise.then(() => {
            //download files from remote servers
            let completed = 0;
            let length = files.length;
            return common.do_n_at_a_time(files, downloadLimit, function (dl_request) {
                let url = dl_request.url;
                let filename = dl_request.filename;

                return json_download_promisified(url,filename).then((filename) => {
                    console.log(`Downloaded ${filename} (${++completed}/${length})`);
                });
            },true);
        });
    }
    this.download = download;

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
    function init(setup_options){
        function single_load(file_obj){
            return new Promise(function(fulfill,reject){
                let file_db = {};
                let file_promises = [];
                for(let f of file_obj.files){
                    let curPromise = load_json_promisified(f.main,f.alternatives)
                        .then(function(result){
                            file_db[f.name] = result;
                            return;
                        }); 
                    file_promises.push(curPromise);
                }

                Promise.all(file_promises).then(function(){
                    return Promise.resolve(file_obj.setupFn(db,file_db,file_obj.name,setup_options))
                        .then(() => {
                            let keys = Object.keys(file_db);
                            for(let f of keys){
                                console.log("Deleting",f);
                                delete file_db[f];
                            }
                        });
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

        return common.do_n_at_a_time(files,1,single_load,true);
    }
    this.init = init;

    this.getDB = () => { return db; };
    this.getStats = () => { return stats; };

    function search(query){
        if (query.verbose === true || query.verbose == 'true'){
            console.log("Search Query:",query);
        }
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
                to_be_translated.push(entry);
            }
        }

        let length = to_be_translated.length;

        console.log(`Translating ${length} entries in ${name}`);

        let translate = (entry) => {
            return options.translate.translate(db[entry])
                .then( () => {console.log(`Translated ${++count_finished}/${length} entries in ${name}`);});
        }

        return common.do_n_at_a_time(to_be_translated, options.translate.max_translations || 5,translate,true);
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

        // if (query.verbose) {
        //     console.log(list);
        // }

        let filterFn = listTarget.filter || common.listFilter;

        return filterFn(query,list);
    }
    this.list = list;
};

module.exports = DBModule;