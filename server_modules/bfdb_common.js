let translate = require('google-translate-api');
let fs = require('fs');

let bfdb_common = function(){
    //helper function to generate files field for server modules
    function generateSetupFiles(files, setupFn){
        let setupArr = [];
        let servers = ['gl', 'eu', 'jp'];
        for (let s of servers) {
            let curObj = {
                name: s,
                files: [],
                setupFn: setupFn
            }
            for (let f of files) {
                curObj.files.push({
                    name: `${f}`,
                    main: `${f}-${s}.json`,
                    alternatives: [`${f}-${s}-old.json`]
                });

            }
            setupArr.push(curObj);
        }
        return setupArr;
    }
    this.generateSetupFiles = generateSetupFiles;

    //search through an entire object for values of a given field_name
    function analyzeObjectForValuesOf(target, field_name) {
        let values = [];
        if (typeof target !== "object") return values;
        let fields = [target];
        while (fields.length > 0) {
            let curField = fields.shift();
            if (typeof curField !== "object") {
                continue;
            }

            for (let f in curField) {
                if (typeof curField[f] === "object") {
                    fields.push(curField[f]);
                }
                if (f == field_name) {
                    if (typeof curField[f] !== "object")
                        values.push(curField[f]);
                    else
                        values.push(JSON.stringify(curField[f]));
                }
            }
        }

        return values;
    }
    this.analyzeObjectForValuesOf = analyzeObjectForValuesOf;

    //default getByID function
    function getByID(id,db){
        let result = db[id];
        if (result === undefined) {
            return { error: `${id} is not found` };
        } else {
            return result;
        }
    }
    this.getByID = getByID;

    function isJapaneseText(name) {
        return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
    }
    this.isJapaneseText = isJapaneseText;
    
    //default translation options
    function needsTranslation(target){
        return isJapaneseText(target.name);
    }
    this.needsTranslation = needsTranslation;

    function defaultTranslate(target){
        function translate_to_english(msg, fields, endField) {
            return translate(msg, { from: 'ja', to: 'en' })
                .then(function (result) {
                    var result_text = "";
                    //clean up result, if necessary
                    if (result.text.indexOf("null") == result.text.length - 4) {
                        result_text = result.text.replace("null", "");
                    } else {
                        result_text = result.text;
                    }
                    return {
                        translation: result_text + "*",
                        fields: fields.concat(endField)
                    };
                }).catch(err => {
                    console.error(err);
                });
        }

        return translate_to_english(target.name, [], "translated_name")
            .then(function (translation_result) {
                target.name = translation_result.translation;
                return;
            });
    }
    this.defaultTranslate = defaultTranslate;

    function updateStatistics(db,name){
        //return everything that's in db_new and not in db_old
        function get_db_diffs(db_old_ids, db_new_ids) {
            // let diffs = [];
            // for (let elem in db_new) {
            //     if (db_old.indexOf(db_new[elem]) === -1) {
            //         diffs.push(db_new[elem]);
            //     }
            // }
            // return diffs;
            return db_new_ids.filter((t) => { return db_old_ids.indexOf(t) === -1; });
        }
        function get_ids_from_server(server, db) {
            var result = [];
            for (let i in db) {
                if (db[i].server.indexOf(server) !== -1) {
                    result.push(i); //i is ID of current object
                }
            }
            return result;
        }
        function update_statistics_per_server(server,name,db) {
            //holds local file load/save functions
            var updater = {
                load: function (file, alternative_files) {
                    try {
                        return JSON.parse(fs.readFileSync("./json/" + file, 'utf8'));
                    } catch (err) {//error, try alternative files
                        if (alternative_files !== undefined && alternative_files.length > 0) {
                            var new_file = alternative_files.pop();
                            return updater.load(new_file, alternative_files);
                        } else {//return an error if none of the files work
                            return JSON.parse(fs.readFileSync("./json/" + file, 'utf8'));
                        }
                    }
                },
                save: function (file, data) {
                    fs.writeFile("./json/" + file, data, function (err) {
                        if (err) {
                            console.log(err);
                        }
                        console.log("Saved " + file);
                        return;
                    });
                }
            };

            console.log(`Updating ${server.toUpperCase()}-${name} statistics...`);
            //gather basic statistics
            let current_id = get_ids_from_server(server, db);
            console.log(server, `current ${name} count`, current_id.length);
            stats[server].total_entries = current_id.length;

            //load previous data, if it exists
            let statistics_data;
            try {
                statistics_data = updater.load(`stats-${name}-${server}.json`);

                //save differences, if any
                let diffs = get_db_diffs(statistics_data.last_loaded,current_id);
                if (statistics_data.last_loaded.length !== current_id.length || diffs.length > 0) {
                    if (statistics_data.last_loaded.length !== stats[server].total_entries){
                        console.log(server, `${name} last length`, statistics_data.last_loaded.length, `/ ${name} current length`, current_id.length);
                    }else if (diffs.length > 0){
                        console.log(server, `Found ${diffs.length} differences`);
                    } 
                    statistics_data.newest = diffs;
                    statistics_data.last_loaded = current_id;
                    updater.save(`stats-${name}-${server}.json`, JSON.stringify(statistics_data));
                }
            } catch (err) { //file doesn't exist
                console.log(`Creating new ${name} stats file for`, server);
                statistics_data = {
                    newest: current_id,
                    last_loaded: current_id
                };
                updater.save(`stats-${name}-${server}.json`, JSON.stringify(statistics_data));
            }

            //keep track of newest on server
            stats[server] = statistics_data.newest;
        }

        let servers = ['gl', 'eu', 'jp'];
        let stats = {
            last_update: new Date().toUTCString()
        };

        for(let s of servers){
            stats[s] = {};
            update_statistics_per_server(s,name,db);
        }

        console.log(`Finished updating ${name} statistics`);
        return stats;
    }
    this.updateStatistics = updateStatistics;

    //adds a section in in the sub database to the main database
    function addFieldToDB(db_main, db_sub, func) {
        for (let target in db_sub) {
            try {
                func(db_main[target], db_sub[target], db_main, db_sub);
            } catch (err) {
                // console.log(`Error with ${target}:`,err);
                console.log(`Skipping ${target} due to error`);
                continue;
            }
        }
    }
    this.addFieldToDB = addFieldToDB;
}

module.exports = new bfdb_common();